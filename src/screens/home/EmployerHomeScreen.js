import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation } from "@react-navigation/native";

import { useAuth } from "../../context/AuthContext";
import { listWorkers } from "../../services/workersService";
import { getSubscriptionStatus } from "../../services/subscriptionsService";
import SignedImage from "../../components/media/SignedImage";
import LocationPickerModal from "../../components/ui/LocationPickerModal";
import TabBarIcon from "../../components/ui/TabBarIcon";
import {
  SERVICE_OPTIONS,
  serviceLabel,
} from "../../utils/workerMeta";
import { formatDistance } from "../../utils/geo";
import { colors, withAlpha } from "../../theme/colors";

// ---------------------------------------------------------------------------
// Employer home — 2026-10-20 redesign (top -> bottom):
//   greeting + location chip -> search -> Post a job / Find a maid CTAs ->
//   category chips -> Maids near you (distance) -> Top rated (+ Near me
//   filter) -> Verified & background-checked -> How it works -> trust strip.
//
// "Near you" is now REAL distance: the employer's saved coords go to
// GET /api/workers?lat=&lng=&sort=near and every worker comes back with
// distance_km (Haversine server-side). No coords / no matches fall back to
// the old area-token match, then to a plain "Available now" rail.
// ---------------------------------------------------------------------------

const CAROUSEL_FETCH = 40; // one page, plenty for three 6-item rails
const RAIL_SIZE = 6;
const NEAR_RADIUS_KM = 25; // "near you" cut-off before we loosen the rail

// Subscription tiles on the home plans section — display-only mirror of the
// server-side PLANS catalog (amounts looked up server-side at push time).
const PLAN_TILES = [
  {
    id: "chat_week",
    name: "Weekly",
    price: 250,
    per: "7 days, unlimited",
    label: "Unlimited chats — 1 week",
  },
  {
    id: "chat_month",
    name: "Monthly",
    price: 800,
    per: "30 days, unlimited",
    label: "Unlimited chats — 1 month",
    best: true,
  },
];

function formatExpiry(iso) {
  try {
    return new Date(iso).toLocaleDateString("en-KE", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

// Emoji per service — zero icon-package weight, reads well at chip size.
const SERVICE_EMOJI = {
  cleaning: "🧹",
  cooking: "🍳",
  childcare: "🧒",
  laundry: "👕",
  elderly_care: "🫶",
  housekeeping: "🏠",
};

function greetingForHour() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

// ---------------------------------------------------------------------------
// Rail cards — memoized with navigation inside (same contract as before:
// the memo key is the `worker` object itself).
// ---------------------------------------------------------------------------

const NearbyMaidCard = React.memo(function NearbyMaidCard({ worker }) {
  const navigation = useNavigation();
  const firstName = (worker.name || "").split(" ")[0] || "?";
  const verified = worker.kycStatus === "verified";
  const distance = formatDistance(worker.distanceKm);

  const onPress = useCallback(
    () => navigation.navigate("WorkerProfile", { workerId: worker.id }),
    [navigation, worker.id]
  );

  return (
    <Pressable
      accessibilityRole="button"
      style={({ pressed }) => [styles.nearCard, pressed && styles.tilePressed]}
      onPress={onPress}
    >
      <View style={styles.nearPhotoWrap}>
        <SignedImage
          url={worker.avatarUrl}
          mediaId={worker.avatarMediaId}
          variant="thumb"
          fallbackText={firstName}
          style={styles.nearPhoto}
          textStyle={styles.nearPhotoText}
        />
        {verified ? (
          <View style={styles.nearVerifiedBadge}>
            <TabBarIcon name="check" color={colors.white} size={9} />
          </View>
        ) : null}
        {distance ? (
          <View style={styles.nearDistancePill}>
            <Text style={styles.nearDistanceText}>{distance}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.nearBody}>
        <Text style={styles.nearName} numberOfLines={1}>
          {worker.name}
        </Text>
        <Text style={styles.nearServices} numberOfLines={1}>
          {(worker.services || []).map(serviceLabel).join(" · ") ||
            "Domestic worker"}
        </Text>
        <Text style={styles.nearMeta} numberOfLines={1}>
          {worker.hourlyRate !== null
            ? `KES ${worker.hourlyRate}/hr`
            : "Rate on ask"}
          {worker.locationLabel ? ` · ${worker.locationLabel}` : ""}
        </Text>
      </View>
    </Pressable>
  );
});

// Shared mini card: powers both "Top rated" and "Verified & background-
// checked" rails (the user's rule — one question per section, shared look).
const MiniMaidCard = React.memo(function MiniMaidCard({ worker, shield }) {
  const navigation = useNavigation();
  const firstName = (worker.name || "").split(" ")[0] || "?";
  const distance = formatDistance(worker.distanceKm);

  const onPress = useCallback(
    () => navigation.navigate("WorkerProfile", { workerId: worker.id }),
    [navigation, worker.id]
  );

  return (
    <Pressable
      accessibilityRole="button"
      style={({ pressed }) => [styles.miniCard, pressed && styles.tilePressed]}
      onPress={onPress}
    >
      <SignedImage
        url={worker.avatarUrl}
        mediaId={worker.avatarMediaId}
        variant="thumb"
        fallbackText={firstName}
        style={styles.miniAvatar}
        textStyle={styles.miniAvatarText}
      />
      <Text style={styles.miniName} numberOfLines={1}>
        {firstName}
      </Text>
      {shield ? (
        <View style={styles.miniShield}>
          <TabBarIcon name="shield" color={colors.brand} size={10} />
          <Text style={styles.miniShieldText}>ID verified</Text>
        </View>
      ) : worker.experienceYears ? (
        <Text style={styles.miniExperience}>
          {worker.experienceYears} {worker.experienceYears === 1 ? "yr" : "yrs"} exp
        </Text>
      ) : (
        <View style={styles.miniSpacer} />
      )}
      <Text style={styles.miniRate}>
        {worker.hourlyRate !== null
          ? `KES ${worker.hourlyRate}/hr`
          : "Rate on ask"}
      </Text>
      {distance ? (
        <Text style={styles.miniDistance}>{distance} away</Text>
      ) : null}
    </Pressable>
  );
});

const HOW_IT_WORKS = [
  {
    icon: "search",
    title: "Tell us what you need",
    body: "Search by skill or area — or post a job with the days and hours you need.",
  },
  {
    icon: "shield",
    title: "Compare verified maids",
    body: "Read profiles and rates, and look for the ID-verified badge.",
  },
  {
    icon: "message-circle",
    title: "Contact safely",
    body: "Unlock a number with M-Pesa when you're ready — workers control who sees it.",
  },
];

export default function EmployerHomeScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();

  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [topNearOnly, setTopNearOnly] = useState(false);
  const [subStatus, setSubStatus] = useState(null);

  // Coords live in a ref so the focus fetch can read the latest values
  // without re-render churn. `fetchedCoordsKeyRef` remembers which coords
  // the last fetch ACTUALLY used: on a cold launch AuthContext hydrates
  // after the first fetch (which then runs without coords and the rail
  // falls back to "Available now"), so the effect below refetches ONCE the
  // moment coords arrive or change — no pull-to-refresh needed.
  const coordsRef = useRef(null);
  if (
    typeof user?.locationLat === "number" &&
    typeof user?.locationLng === "number"
  ) {
    coordsRef.current = { lat: user.locationLat, lng: user.locationLng };
  }
  const fetchedCoordsKeyRef = useRef(null);
  // Monotonic sequence: only the newest fetch may commit state (a slow
  // no-coords response must never overwrite a fresh coords response).
  const fetchSeqRef = useRef(0);

  const firstName = (user?.name || "").split(" ")[0] || "";

  // Set false whenever the tab loses focus (and on unmount) so late
  // responses never setState on a dead screen.
  const aliveRef = useRef(true);

  const fetchWorkers = useCallback(async ({ asRefresh } = {}) => {
    if (asRefresh) setRefreshing(true);

    const seq = ++fetchSeqRef.current;
    const coords = coordsRef.current;
    fetchedCoordsKeyRef.current = coords
      ? `${coords.lat},${coords.lng}`
      : "none";

    try {
      const data = await listWorkers({
        limit: CAROUSEL_FETCH,
        ...(coords ? { lat: coords.lat, lng: coords.lng, sort: "near" } : {}),
      });
      if (!aliveRef.current || seq !== fetchSeqRef.current) return;
      setWorkers(data.workers || []);
      setLoadError(false);
    } catch {
      // Home treats failures as non-fatal, but they must not read as
      // "no workers exist" — the error state changes the empty-box copy
      // and offers a retry (this exact silence once hid a gateway 500).
      if (!aliveRef.current || seq !== fetchSeqRef.current) return;
      setWorkers([]);
      setLoadError(true);
    } finally {
      if (aliveRef.current && seq === fetchSeqRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  // Fresh picks every time the tab regains focus (cheap: one 40-row page).
  // Also refreshes the subscription status for the plans section.
  useFocusEffect(
    useCallback(() => {
      aliveRef.current = true;
      fetchWorkers();

      (async () => {
        try {
          const data = await getSubscriptionStatus();
          if (aliveRef.current) setSubStatus(data);
        } catch {
          // Non-fatal — the plans section falls back to the generic upsell.
        }
      })();

      return () => {
        aliveRef.current = false;
      };
    }, [fetchWorkers])
  );

  // Cold-launch fix: AuthContext hydrates AFTER the first focus fetch, so
  // the first fetch usually runs without coords. The moment coords arrive
  // (or change after a location save), refetch once — "Maids near you"
  // with real distances appears without leaving the tab.
  useEffect(() => {
    if (
      typeof user?.locationLat !== "number" ||
      typeof user?.locationLng !== "number"
    ) {
      return;
    }

    const key = `${user.locationLat},${user.locationLng}`;
    if (key !== fetchedCoordsKeyRef.current) {
      fetchWorkers();
    }
  }, [user?.locationLat, user?.locationLng, fetchWorkers]);

  const hasCoords = Boolean(coordsRef.current);

  // "Maids near you" — real distance when we have coords (server already
  // returned workers sorted near-first), else the old area-token match.
  const near = useMemo(() => {
    if (hasCoords) {
      const withDistance = workers
        .filter((w) => w.distanceKm !== null && w.distanceKm <= NEAR_RADIUS_KM)
        .sort((a, b) => a.distanceKm - b.distanceKm);

      if (withDistance.length >= 2) {
        return { list: withDistance.slice(0, RAIL_SIZE), matched: true };
      }
      // Nobody within the radius yet — widen instead of an empty rail.
      const anyDistance = workers
        .filter((w) => w.distanceKm !== null)
        .sort((a, b) => a.distanceKm - b.distanceKm);
      if (anyDistance.length >= 2) {
        return { list: anyDistance.slice(0, RAIL_SIZE), matched: true };
      }
      return { list: workers.slice(0, RAIL_SIZE), matched: false };
    }

    const area = (user?.locationLabel || "").trim();
    if (!area) {
      return { list: workers.slice(0, RAIL_SIZE), matched: false };
    }

    const tokens = area
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);

    const matches = workers.filter((w) => {
      const loc = (w.locationLabel || "").trim().toLowerCase();
      if (!loc) return false;
      return tokens.some((t) => loc.includes(t) || t.includes(loc));
    });

    const hit = matches.length >= 2;
    return { list: (hit ? matches : workers).slice(0, RAIL_SIZE), matched: hit };
  }, [workers, hasCoords, user?.locationLabel]);

  // "Top rated" — verified first, then most experienced. With the "Near me"
  // filter on, rank the near set by real distance instead.
  const top = useMemo(() => {
    if (topNearOnly && hasCoords) {
      return [...near.list]
        .sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999))
        .slice(0, RAIL_SIZE);
    }
    return [...workers]
      .sort((a, b) => {
        const va = a.kycStatus === "verified" ? 1 : 0;
        const vb = b.kycStatus === "verified" ? 1 : 0;
        if (va !== vb) return vb - va;
        return (b.experienceYears || 0) - (a.experienceYears || 0);
      })
      .slice(0, RAIL_SIZE);
  }, [workers, near.list, topNearOnly, hasCoords]);

  // "Verified & background-checked" — the trust section doubles as the
  // featured/recommended rail. Hidden unless we can show at least 3.
  const verified = useMemo(
    () =>
      workers
        .filter((w) => w.kycStatus === "verified")
        .slice(0, RAIL_SIZE),
    [workers]
  );

  const nearTitle = near.matched ? "Maids near you" : "Available now";
  const locationChipLabel =
    user?.locationLabel ||
    (hasCoords ? "Current location" : "Set your location");

  const renderNear = useCallback(({ item }) => <NearbyMaidCard worker={item} />, []);
  const renderTop = useCallback(
    ({ item }) => <MiniMaidCard worker={item} />,
    []
  );
  const renderVerified = useCallback(
    ({ item }) => <MiniMaidCard worker={item} shield />,
    []
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.cream} />

      <ScrollView
        style={styles.bodyScroll}
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchWorkers({ asRefresh: true })}
            tintColor={colors.brand}
            colors={[colors.brand]}
          />
        }
      >
        {/* ---------- Greeting + location chip (new header) ---------- */}
        <Text style={styles.karibu}>
          {greetingForHour()}
          {firstName ? `, ${firstName}` : ""} 👋
        </Text>

        <Pressable
          accessibilityRole="button"
          style={styles.locationChip}
          onPress={() => setPickerOpen(true)}
        >
          <TabBarIcon name="map-pin" color={colors.brand} size={14} />
          <Text style={styles.locationText} numberOfLines={1}>
            {locationChipLabel}
          </Text>
          <Text style={styles.locationChange}>Change</Text>
        </Pressable>

        {/* ---------- Search ---------- */}
        <Pressable
          accessibilityRole="button"
          style={styles.searchCard}
          onPress={() => navigation.navigate("MaidsTab")}
        >
          <TabBarIcon name="search" color={colors.textMuted} size={19} />
          <Text style={styles.searchText}>Search name, skill or area…</Text>
        </Pressable>

        {/* ---------- Primary CTAs ---------- */}
        <View style={styles.ctaRow}>
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.postJob,
              styles.ctaPrimary,
              pressed && styles.tilePressedDark,
            ]}
            onPress={() => navigation.navigate("MyJobsTab")}
          >
            <TabBarIcon name="file-text" color={colors.white} size={18} />
            <Text style={styles.postJobText}>Post a job</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.findMaid,
              styles.ctaSecondary,
              pressed && styles.tilePressed,
            ]}
            onPress={() => navigation.navigate("MaidsTab")}
          >
            <TabBarIcon name="users" color={colors.brand} size={18} />
            <Text style={styles.findMaidText}>Find a maid</Text>
          </Pressable>
        </View>

        {/* ---------- Categories ---------- */}
        <Text style={styles.sectionTitle}>What do you need help with?</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
        >
          {SERVICE_OPTIONS.map((option) => (
            <Pressable
              key={option.value}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.categoryChip,
                pressed && styles.tilePressed,
              ]}
              onPress={() =>
                navigation.navigate("MaidsTab", { service: option.value })
              }
            >
              <Text style={styles.categoryEmoji}>
                {SERVICE_EMOJI[option.value] || "✨"}
              </Text>
              <Text style={styles.categoryLabel}>{option.label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* ---------- Workers ---------- */}
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={colors.brand} />
          </View>
        ) : workers.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>
              {loadError
                ? "Couldn't load workers just now. Check your connection and try again."
                : "No worker profiles yet. They'll appear here as domestic workers complete their profiles."}
            </Text>
            {loadError ? (
              <Pressable
                accessibilityRole="button"
                style={styles.retryButton}
                onPress={() => {
                  setLoading(true);
                  fetchWorkers();
                }}
              >
                <Text style={styles.retryText}>Try again</Text>
              </Pressable>
            ) : null}
          </View>
        ) : (
          <>
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>{nearTitle}</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => navigation.navigate("MaidsTab")}
              >
                <Text style={styles.seeAll}>See all</Text>
              </Pressable>
            </View>
            <FlatList
              horizontal
              data={near.list}
              keyExtractor={(item) => item.id}
              renderItem={renderNear}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.rail}
              initialNumToRender={4}
              maxToRenderPerBatch={4}
              windowSize={3}
              removeClippedSubviews
            />

            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>Top rated</Text>
              <View style={styles.sectionHeadRight}>
                {hasCoords ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: topNearOnly }}
                    style={[
                      styles.filterChip,
                      topNearOnly && styles.filterChipOn,
                    ]}
                    onPress={() => setTopNearOnly((v) => !v)}
                  >
                    <TabBarIcon
                      name="map-pin"
                      color={topNearOnly ? colors.white : colors.brand}
                      size={10}
                    />
                    <Text
                      style={[
                        styles.filterChipText,
                        topNearOnly && styles.filterChipTextOn,
                      ]}
                    >
                      Near me
                    </Text>
                  </Pressable>
                ) : null}
                <Pressable
                  accessibilityRole="button"
                  onPress={() => navigation.navigate("MaidsTab")}
                >
                  <Text style={styles.seeAll}>See all</Text>
                </Pressable>
              </View>
            </View>
            <FlatList
              horizontal
              data={top}
              keyExtractor={(item) => item.id}
              renderItem={renderTop}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.rail}
              initialNumToRender={4}
              maxToRenderPerBatch={4}
              windowSize={3}
              removeClippedSubviews
            />

            {verified.length >= 3 ? (
              <>
                <View style={styles.sectionHead}>
                  <Text style={styles.sectionTitle}>
                    Verified &amp; background-checked
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => navigation.navigate("MaidsTab")}
                  >
                    <Text style={styles.seeAll}>See all</Text>
                  </Pressable>
                </View>
                <FlatList
                  horizontal
                  data={verified}
                  keyExtractor={(item) => item.id}
                  renderItem={renderVerified}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.rail}
                  initialNumToRender={4}
                  maxToRenderPerBatch={4}
                  windowSize={3}
                  removeClippedSubviews
                />
              </>
            ) : null}
          </>
        )}

        {/* ---------- How it works ---------- */}
        <Text style={styles.sectionTitle}>How it works</Text>
        <View style={styles.stepsCard}>
          {HOW_IT_WORKS.map((step, index) => (
            <View key={step.title} style={styles.stepRow}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepBadgeText}>{index + 1}</Text>
              </View>
              <View style={styles.stepMain}>
                <Text style={styles.stepTitle}>{step.title}</Text>
                <Text style={styles.stepBody}>{step.body}</Text>
              </View>
              <TabBarIcon
                name={step.icon}
                color={withAlpha(colors.brand, 0.55)}
                size={18}
              />
            </View>
          ))}
        </View>

        {/* ---------- Trust strip ---------- */}
        <View style={styles.trustCard}>
          <TabBarIcon name="shield" color={colors.brand} size={17} />
          <Text style={styles.trustText}>
            Every contact unlock is paid through M-Pesa and workers keep
            control of who sees their number.
          </Text>
        </View>

        {/* ---------- Subscription plans (right after the M-Pesa banner) ---------- */}
        <View style={styles.planCard}>
          <View style={styles.planHead}>
            <Text style={styles.planTitle}>Chat without limits</Text>
            {subStatus?.hasSubscription ? (
              <View style={styles.planActivePill}>
                <Text style={styles.planActiveText}>Active</Text>
              </View>
            ) : null}
          </View>

          {subStatus?.hasSubscription ? (
            <Text style={styles.planActiveCopy}>
              {subStatus.planLabel} · unlimited chats until{" "}
              {formatExpiry(subStatus.expiresAt)}.
            </Text>
          ) : (
            <>
              <Text style={styles.planCopy}>
                Message any maid without paying per conversation.
              </Text>
              <View style={styles.planRow}>
                {PLAN_TILES.map((plan) => (
                  <Pressable
                    key={plan.id}
                    accessibilityRole="button"
                    style={({ pressed }) => [
                      styles.planTile,
                      plan.best && styles.planTileBest,
                      pressed && styles.tilePressed,
                    ]}
                    onPress={() =>
                      navigation.navigate("MpesaCheckout", {
                        plan: plan.id,
                        label: plan.label,
                      })
                    }
                  >
                    {plan.best ? (
                      <View style={styles.planBest}>
                        <Text style={styles.planBestText}>Best value</Text>
                      </View>
                    ) : null}
                    <Text style={styles.planName}>{plan.name}</Text>
                    <Text style={styles.planPrice}>KES {plan.price}</Text>
                    <Text style={styles.planPer}>{plan.per}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.planFootnote}>
                Prefer one conversation? A one-time chat is KES 200 on any
                maid's profile.
              </Text>
            </>
          )}
        </View>
      </ScrollView>

      <LocationPickerModal
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  bodyScroll: {
    flex: 1,
  },
  body: {
    padding: 20,
    paddingBottom: 36,
  },

  /* ---- Header: greeting + location chip ---- */
  karibu: {
    color: colors.ink,
    fontSize: 24,
    fontWeight: "800",
    marginBottom: 10,
  },
  locationChip: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.mistDark,
    borderRadius: 999,
    paddingLeft: 12,
    paddingRight: 8,
    paddingVertical: 7,
    gap: 6,
    marginBottom: 14,
    maxWidth: "100%",
  },
  locationText: {
    flexShrink: 1,
    color: colors.ink,
    fontSize: 12.5,
    fontWeight: "700",
  },
  locationChange: {
    color: colors.brand,
    fontSize: 12,
    fontWeight: "800",
    marginLeft: 2,
  },

  /* ---- Search ---- */
  searchCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.mistDark,
    borderRadius: 14,
    minHeight: 50,
    paddingHorizontal: 15,
    gap: 10,
    marginBottom: 12,
  },
  searchText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "600",
    flex: 1,
  },

  /* ---- Primary CTAs ---- */
  ctaRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 20,
  },
  postJob: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 15,
    minHeight: 52,
    paddingHorizontal: 14,
  },
  ctaPrimary: {
    flex: 1.15,
    backgroundColor: colors.brand,
  },
  postJobText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: "800",
  },
  findMaid: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 15,
    minHeight: 52,
    paddingHorizontal: 14,
  },
  ctaSecondary: {
    flex: 1,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.brand,
  },
  findMaidText: {
    color: colors.brand,
    fontSize: 14,
    fontWeight: "800",
  },
  tilePressed: {
    backgroundColor: colors.mist,
  },
  tilePressedDark: {
    backgroundColor: "#1A3D2E",
  },

  /* ---- Sections ---- */
  sectionTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 12,
  },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    marginTop: 4,
  },
  sectionHeadRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  seeAll: {
    color: colors.brand,
    fontSize: 13,
    fontWeight: "800",
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: colors.brand,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
    backgroundColor: colors.white,
  },
  filterChipOn: {
    backgroundColor: colors.brand,
  },
  filterChipText: {
    color: colors.brand,
    fontSize: 11,
    fontWeight: "800",
  },
  filterChipTextOn: {
    color: colors.white,
  },
  chipsRow: {
    paddingRight: 20,
    marginBottom: 18,
    gap: 8,
  },

  /* ---- Category chips ---- */
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.mist,
    borderRadius: 999,
    paddingLeft: 12,
    paddingRight: 14,
    paddingVertical: 8,
    gap: 7,
  },
  categoryEmoji: {
    fontSize: 14,
  },
  categoryLabel: {
    color: colors.ink,
    fontSize: 12.5,
    fontWeight: "700",
  },

  /* ---- Rails ---- */
  rail: {
    paddingRight: 20,
    marginBottom: 18,
    gap: 10,
  },

  /* ---- Nearby card (photo top) ---- */
  nearCard: {
    width: 196,
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.mist,
    overflow: "hidden",
  },
  nearPhotoWrap: {
    position: "relative",
  },
  nearPhoto: {
    width: "100%",
    height: 108,
    backgroundColor: withAlpha(colors.brand, 0.14),
  },
  nearPhotoText: {
    color: colors.brand,
    fontSize: 30,
    fontWeight: "800",
  },
  nearVerifiedBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  nearDistancePill: {
    position: "absolute",
    bottom: 8,
    right: 8,
    backgroundColor: "rgba(38, 49, 43, 0.78)",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  nearDistanceText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: "800",
  },
  nearBody: {
    padding: 11,
  },
  nearName: {
    color: colors.ink,
    fontSize: 13.5,
    fontWeight: "800",
  },
  nearServices: {
    color: colors.textFaint,
    fontSize: 11,
    fontWeight: "600",
    marginTop: 2,
  },
  nearMeta: {
    color: colors.textMuted,
    fontSize: 11.5,
    fontWeight: "700",
    marginTop: 4,
  },

  /* ---- Mini card (Top rated / Verified) ---- */
  miniCard: {
    width: 128,
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.mist,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: "center",
  },
  miniAvatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: withAlpha(colors.brand, 0.14),
    marginBottom: 8,
    overflow: "hidden",
  },
  miniAvatarText: {
    color: colors.brand,
    fontSize: 20,
    fontWeight: "800",
  },
  miniName: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "800",
    maxWidth: "100%",
  },
  miniShield: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: withAlpha(colors.brand, 0.13),
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 3,
    marginTop: 4,
  },
  miniShieldText: {
    color: colors.brand,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  miniExperience: {
    color: colors.textMuted,
    fontSize: 10.5,
    fontWeight: "700",
    marginTop: 5,
  },
  miniSpacer: {
    height: 14,
    marginTop: 5,
  },
  miniRate: {
    color: colors.brand,
    fontSize: 11.5,
    fontWeight: "800",
    marginTop: 5,
  },
  miniDistance: {
    color: colors.textFaint,
    fontSize: 10,
    fontWeight: "600",
    marginTop: 2,
  },

  /* ---- How it works ---- */
  stepsCard: {
    backgroundColor: colors.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.mist,
    padding: 6,
    marginBottom: 14,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 11,
    paddingHorizontal: 12,
  },
  stepBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: withAlpha(colors.brand, 0.12),
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  stepBadgeText: {
    color: colors.brand,
    fontSize: 12.5,
    fontWeight: "800",
  },
  stepMain: {
    flex: 1,
    marginRight: 10,
  },
  stepTitle: {
    color: colors.ink,
    fontSize: 13.5,
    fontWeight: "800",
  },
  stepBody: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 16.5,
    marginTop: 2,
  },

  /* ---- Loading / empty ---- */
  loadingBox: {
    paddingVertical: 28,
    alignItems: "center",
  },
  emptyBox: {
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.mist,
    padding: 16,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19.5,
    textAlign: "center",
  },
  retryButton: {
    alignSelf: "center",
    marginTop: 12,
    backgroundColor: colors.brand,
    borderRadius: 12,
    paddingHorizontal: 18,
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  retryText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: "800",
  },

  /* ---- Trust ---- */
  trustCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: withAlpha(colors.gold, 0.13),
    borderRadius: 16,
    padding: 14,
    gap: 10,
    marginTop: 4,
  },
  trustText: {
    flex: 1,
    color: colors.goldDark,
    fontSize: 12,
    lineHeight: 17.5,
    fontWeight: "600",
  },

  /* ---- Subscription plans ---- */
  planCard: {
    backgroundColor: colors.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.mist,
    padding: 16,
    marginTop: 12,
  },
  planHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  planTitle: {
    color: colors.ink,
    fontSize: 15.5,
    fontWeight: "800",
    flex: 1,
  },
  planActivePill: {
    backgroundColor: withAlpha(colors.brand, 0.14),
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  planActiveText: {
    color: colors.brand,
    fontSize: 10.5,
    fontWeight: "800",
  },
  planActiveCopy: {
    color: colors.textMuted,
    fontSize: 12.5,
    lineHeight: 19,
    marginTop: 8,
  },
  planCopy: {
    color: colors.textMuted,
    fontSize: 12.5,
    lineHeight: 19,
    marginTop: 4,
    marginBottom: 12,
  },
  planRow: {
    flexDirection: "row",
    gap: 10,
  },
  planTile: {
    flex: 1,
    backgroundColor: colors.cream,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.mist,
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: "center",
  },
  planTileBest: {
    borderColor: colors.gold,
    backgroundColor: withAlpha(colors.gold, 0.1),
  },
  planBest: {
    position: "absolute",
    top: -9,
    backgroundColor: colors.gold,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  planBestText: {
    color: colors.white,
    fontSize: 9.5,
    fontWeight: "800",
  },
  planName: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "800",
  },
  planPrice: {
    color: colors.ink,
    fontSize: 19,
    fontWeight: "800",
    marginTop: 4,
  },
  planPer: {
    color: colors.textFaint,
    fontSize: 10.5,
    fontWeight: "700",
    marginTop: 3,
    textAlign: "center",
  },
  planFootnote: {
    color: colors.textFaint,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 12,
    textAlign: "center",
  },
});

