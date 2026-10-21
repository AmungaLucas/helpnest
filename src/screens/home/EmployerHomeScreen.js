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
import EmptyState from "../../components/ui/EmptyState";
import {
  SERVICE_OPTIONS,
  serviceLabel,
} from "../../utils/workerMeta";
import { formatDistance } from "../../utils/geo";
import { colors, withAlpha } from "../../theme/colors";

const CAROUSEL_FETCH = 40;
const RAIL_SIZE = 6;
const NEAR_RADIUS_KM = 25;

const PLAN_TILES = [
  {
    id: "emp_basic",
    name: "Basic",
    price: 499,
    per: "3 chats + 3 posts · 7 days",
    label: "Basic — 3 chats + 3 job posts",
  },
  {
    id: "emp_gold",
    name: "Gold",
    price: 899,
    per: "7 chats + 5 posts · 7 days",
    label: "Gold — 7 chats + 5 job posts",
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
// Card #1 — Maids near you: POSTER card (reverted to previous design)
//   Photo on top, verified white-circle badge top-left, distance pill
//   bottom-right, body below with name / services / hairline footer that
//   shows rate + location.
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
      android_ripple={{ color: withAlpha(colors.brand, 0.08) }}
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
            <TabBarIcon name="check" color={colors.brand} size={11} />
          </View>
        ) : null}
        {distance ? (
          <View style={styles.nearDistancePill}>
            <TabBarIcon name="map-pin" color={colors.white} size={9} />
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

        <View style={styles.nearFooter}>
          <Text style={styles.nearRate}>
            {worker.hourlyRate !== null
              ? `KES ${worker.hourlyRate}/hr`
              : "Rate on ask"}
          </Text>
          {worker.locationLabel ? (
            <Text style={styles.nearLocation} numberOfLines={1}>
              · {worker.locationLabel}
            </Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
});

// ---------------------------------------------------------------------------
// Card #2 — Top rated: HORIZONTAL SPLIT card.
//   Left: square portrait with rank badge (#1/#2...) + verified check.
//   Right: name, services, hairline divider, rate + experience chip.
// ---------------------------------------------------------------------------
const TopRatedCard = React.memo(function TopRatedCard({ worker, rank }) {
  const navigation = useNavigation();
  const firstName = (worker.name || "").split(" ")[0] || "?";
  const verified = worker.kycStatus === "verified";

  const onPress = useCallback(
    () => navigation.navigate("WorkerProfile", { workerId: worker.id }),
    [navigation, worker.id]
  );

  return (
    <Pressable
      accessibilityRole="button"
      android_ripple={{ color: withAlpha(colors.brand, 0.08) }}
      style={({ pressed }) => [styles.topCard, pressed && styles.tilePressed]}
      onPress={onPress}
    >
      <View style={styles.topPhotoWrap}>
        <SignedImage
          url={worker.avatarUrl}
          mediaId={worker.avatarMediaId}
          variant="thumb"
          fallbackText={firstName}
          style={styles.topPhoto}
          textStyle={styles.topPhotoText}
        />
        {rank ? (
          <View style={styles.topRankBadge}>
            <Text style={styles.topRankText}>#{rank}</Text>
          </View>
        ) : null}
        {verified ? (
          <View style={styles.topVerifyDot}>
            <TabBarIcon name="check" color={colors.white} size={10} />
          </View>
        ) : null}
      </View>

      <View style={styles.topInfo}>
        <Text style={styles.topName} numberOfLines={1}>
          {worker.name}
        </Text>
        <Text style={styles.topServices} numberOfLines={2}>
          {(worker.services || []).map(serviceLabel).join(" · ") ||
            "Domestic worker"}
        </Text>

        <View style={styles.topDivider} />

        <View style={styles.topMetaRow}>
          <Text style={styles.topRate} numberOfLines={1}>
            {worker.hourlyRate !== null
              ? `KES ${worker.hourlyRate}/hr`
              : "Rate on ask"}
          </Text>
          {worker.experienceYears ? (
            <View style={styles.topExpChip}>
              <Text style={styles.topExpChipText}>
                {worker.experienceYears}{" "}
                {worker.experienceYears === 1 ? "yr" : "yrs"}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
});

// ---------------------------------------------------------------------------
// Card #3 — Verified: GOLD RIBBON certificate card.
//   Gold banner on top ("ID VERIFIED" + shield), then a white body with a
//   gold-ringed avatar, name, experience, and rate in gold. Reads as a
//   certified listing — visually distinct from both near (poster) and top
//   rated (horizontal split).
// ---------------------------------------------------------------------------
const VerifiedCard = React.memo(function VerifiedCard({ worker }) {
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
      android_ripple={{ color: withAlpha(colors.gold, 0.14) }}
      style={({ pressed }) => [
        styles.verifiedCard,
        pressed && styles.tilePressed,
      ]}
      onPress={onPress}
    >
      <View style={styles.verifiedRibbon}>
        <TabBarIcon name="shield" color={colors.goldDark} size={11} />
        <Text style={styles.verifiedRibbonText}>ID VERIFIED</Text>
      </View>

      <View style={styles.verifiedBody}>
        <View style={styles.verifiedAvatarRing}>
          <SignedImage
            url={worker.avatarUrl}
            mediaId={worker.avatarMediaId}
            variant="thumb"
            fallbackText={firstName}
            style={styles.verifiedAvatar}
            textStyle={styles.verifiedAvatarText}
          />
        </View>

        <Text style={styles.verifiedName} numberOfLines={1}>
          {firstName}
        </Text>

        {worker.experienceYears ? (
          <Text style={styles.verifiedExp}>
            {worker.experienceYears}{" "}
            {worker.experienceYears === 1 ? "yr" : "yrs"} exp
          </Text>
        ) : (
          <View style={styles.verifiedSpacer} />
        )}

        <Text style={styles.verifiedRate}>
          {worker.hourlyRate !== null
            ? `KES ${worker.hourlyRate}/hr`
            : "Rate on ask"}
        </Text>

        {distance ? (
          <Text style={styles.verifiedDistance}>{distance} away</Text>
        ) : null}
      </View>
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

  const coordsRef = useRef(null);
  if (
    typeof user?.locationLat === "number" &&
    typeof user?.locationLng === "number"
  ) {
    coordsRef.current = { lat: user.locationLat, lng: user.locationLng };
  }
  const fetchedCoordsKeyRef = useRef(null);
  const fetchSeqRef = useRef(0);

  const firstName = (user?.name || "").split(" ")[0] || "";

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

  const near = useMemo(() => {
    if (hasCoords) {
      const withDistance = workers
        .filter((w) => w.distanceKm !== null && w.distanceKm <= NEAR_RADIUS_KM)
        .sort((a, b) => a.distanceKm - b.distanceKm);

      if (withDistance.length >= 2) {
        return { list: withDistance.slice(0, RAIL_SIZE), matched: true };
      }
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
    ({ item, index }) => <TopRatedCard worker={item} rank={index + 1} />,
    []
  );
  const renderVerified = useCallback(
    ({ item }) => <VerifiedCard worker={item} />,
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
        {/* ---------- Hero ---------- */}
        <View style={styles.hero}>
          <View style={styles.orb1} />
          <View style={styles.orb2} />
          <View style={styles.orb3} />

          <Text style={styles.kicker}>EMPLOYER · HOME</Text>
          <Text style={styles.karibu}>
            {greetingForHour()}
            {firstName ? `, ${firstName}` : ""} 👋
          </Text>
          <Text style={styles.lede}>
            Trusted help for your home — search, compare and hire safely.
          </Text>

          <Pressable
            accessibilityRole="button"
            android_ripple={{ color: withAlpha(colors.brand, 0.1) }}
            style={({ pressed }) => [
              styles.locationRow,
              pressed && styles.pressedDim,
            ]}
            onPress={() => setPickerOpen(true)}
          >
            <View style={styles.locationIconChip}>
              <TabBarIcon name="map-pin" color={colors.brand} size={13} />
            </View>
            <Text style={styles.locationText} numberOfLines={1}>
              {locationChipLabel}
            </Text>
            <Text style={styles.locationChange}>Change</Text>
          </Pressable>
        </View>

        <View style={styles.content}>
          {/* ---------- Search ---------- */}
          <Pressable
            accessibilityRole="button"
            android_ripple={{ color: withAlpha(colors.brand, 0.06) }}
            style={({ pressed }) => [
              styles.searchCard,
              pressed && styles.pressedDim,
            ]}
            onPress={() => navigation.navigate("MaidsTab")}
          >
            <TabBarIcon name="search" color={colors.textMuted} size={18} />
            <Text style={styles.searchText}>Search name, skill or area…</Text>
          </Pressable>

          {/* ---------- Primary CTAs (initial design) ---------- */}
          <View style={styles.ctaRow}>
            <Pressable
              accessibilityRole="button"
              android_ripple={{ color: withAlpha(colors.white, 0.16) }}
              style={({ pressed }) => [
                styles.postJob,
                styles.ctaPrimary,
                pressed && styles.pressedDim,
              ]}
              onPress={() => navigation.navigate("PostJob")}
            >
              <TabBarIcon name="file-text" color={colors.white} size={18} />
              <Text style={styles.postJobText}>Post a job</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              android_ripple={{ color: withAlpha(colors.brand, 0.08) }}
              style={({ pressed }) => [
                styles.findMaid,
                styles.ctaSecondary,
                pressed && styles.pressedDim,
              ]}
              onPress={() => navigation.navigate("MaidsTab")}
            >
              <TabBarIcon name="users" color={colors.brand} size={18} />
              <Text style={styles.findMaidText}>Find a maid</Text>
            </Pressable>
          </View>

          {/* ---------- Categories ---------- */}
          <View style={styles.sectionHead}>
            <View style={styles.sectionHeadLeft}>
              <Text style={styles.eyebrow}>SERVICES</Text>
              <Text style={styles.sectionTitle}>
                What do you need help with?
              </Text>
            </View>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsRow}
          >
            {SERVICE_OPTIONS.map((option) => (
              <Pressable
                key={option.value}
                accessibilityRole="button"
                android_ripple={{ color: withAlpha(colors.brand, 0.08) }}
                style={({ pressed }) => [
                  styles.categoryChip,
                  pressed && styles.categoryChipPressed,
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
            <EmptyState
              icon={loadError ? "alert-triangle" : "users"}
              tone={loadError ? "danger" : "brand"}
              title={loadError ? "Connection hiccup" : "No workers yet"}
              body={
                loadError
                  ? "Couldn't load workers just now. Check your connection and try again."
                  : "No worker profiles yet. They'll appear here as domestic workers complete their profiles."
              }
              actionLabel={loadError ? "Try again" : undefined}
              onAction={
                loadError
                  ? () => {
                      setLoading(true);
                      fetchWorkers();
                    }
                  : undefined
              }
            />
          ) : (
            <>
              <View style={styles.sectionHead}>
                <View style={styles.sectionHeadLeft}>
                  <Text style={styles.eyebrow}>AROUND YOU</Text>
                  <Text style={styles.sectionTitle}>{nearTitle}</Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  android_ripple={{ color: withAlpha(colors.brand, 0.08) }}
                  style={({ pressed }) => [
                    styles.seeAllHit,
                    pressed && styles.pressedDim,
                  ]}
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
                <View style={styles.sectionHeadLeft}>
                  <Text style={styles.eyebrow}>TOP PICKS</Text>
                  <Text style={styles.sectionTitle}>Top rated</Text>
                </View>
                <View style={styles.sectionHeadRight}>
                  {hasCoords ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ selected: topNearOnly }}
                      android_ripple={{ color: withAlpha(colors.brand, 0.08) }}
                      style={({ pressed }) => [
                        styles.filterChip,
                        topNearOnly && styles.filterChipOn,
                        pressed && styles.pressedDim,
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
                    android_ripple={{ color: withAlpha(colors.brand, 0.08) }}
                    style={({ pressed }) => [
                      styles.seeAllHit,
                      pressed && styles.pressedDim,
                    ]}
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

<<<<<<< HEAD
              {verified.length >= 3 ? (
                <>
                  <View style={styles.sectionHead}>
                    <View style={styles.sectionHeadLeft}>
                      <Text style={styles.eyebrow}>TRUSTED PROFILES</Text>
                      <Text style={styles.sectionTitle}>
                        Verified &amp; background-checked
                      </Text>
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      android_ripple={{ color: withAlpha(colors.brand, 0.08) }}
                      style={({ pressed }) => [
                        styles.seeAllHit,
                        pressed && styles.pressedDim,
                      ]}
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

          {/* ---------- Featured promo: boost a job (dark card) ---------- */}
          <Pressable
            accessibilityRole="button"
            android_ripple={{ color: withAlpha(colors.white, 0.1) }}
=======
        {/* ---------- Featured promo: boost a job ----------
            Gold "ad" card matching the maid-side Featured promo and the
            Subscription-plan border family — elevation on the OPAQUE
            boostShadow wrapper, alpha fill + 1px alpha border on the
            elevation-free inner (no dark silhouette through the tint). */}
        <View style={styles.boostShadow}>
          <Pressable
            accessibilityRole="button"
            android_ripple={{ color: withAlpha(colors.gold, 0.14) }}
>>>>>>> d830733d38ef2b743840de3012addd3fe4c1e61c
            style={({ pressed }) => [
              styles.promoCard,
              pressed && styles.pressedDim,
            ]}
            onPress={() => navigation.navigate("MyJobsTab")}
          >
<<<<<<< HEAD
            <View style={styles.promoTopRow}>
              <View style={styles.promoBadge}>
                <TabBarIcon name="zap" color={colors.gold} size={17} />
=======
            <View style={styles.boostBadge}>
              <TabBarIcon name="zap" color={colors.goldDark} size={19} />
            </View>
            <View style={styles.boostBody}>
              <Text style={styles.boostEyebrow}>Featured</Text>
              <Text style={styles.boostTitle}>Get more applicants</Text>
              <Text style={styles.boostCopy}>
                Urgent (24h) or Spotlight placement from My Jobs.
              </Text>
            </View>
            <TabBarIcon name="chevron-right" color={colors.goldDark} size={16} />
          </Pressable>
        </View>

        {/* ---------- How it works ---------- */}
        <View style={styles.sectionHead}>
          <View style={styles.sectionHeadLeft}>
            <Text style={styles.eyebrow}>Simple process</Text>
            <Text style={styles.sectionTitle}>How it works</Text>
          </View>
        </View>
        <View style={styles.stepsCard}>
          {HOW_IT_WORKS.map((step, index) => (
            <View
              key={step.title}
              style={[styles.stepRow, index > 0 && styles.stepDivided]}
            >
              <View style={styles.stepNumWrap}>
                <Text style={styles.stepNum}>{index + 1}</Text>
>>>>>>> d830733d38ef2b743840de3012addd3fe4c1e61c
              </View>
              <Text style={styles.promoEyebrow}>FEATURED</Text>
            </View>

            <Text style={styles.promoTitle}>Get more applicants</Text>
            <Text style={styles.promoCopy}>
              Boost any job with Urgent (24h) or Spotlight placement from My
              Jobs.
            </Text>

            <View style={styles.promoCta}>
              <Text style={styles.promoCtaText}>Go to My Jobs</Text>
              <TabBarIcon name="chevron-right" color={colors.ink} size={14} />
            </View>
          </Pressable>

          {/* ---------- How it works ---------- */}
          <View style={styles.sectionHead}>
            <View style={styles.sectionHeadLeft}>
              <Text style={styles.eyebrow}>SIMPLE PROCESS</Text>
              <Text style={styles.sectionTitle}>How it works</Text>
            </View>
          </View>
          <View style={styles.stepsCard}>
            {HOW_IT_WORKS.map((step, index) => (
              <View
                key={step.title}
                style={[styles.stepRow, index > 0 && styles.stepDivided]}
              >
                <View style={styles.stepNumWrap}>
                  <Text style={styles.stepNum}>{index + 1}</Text>
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
            <TabBarIcon name="shield" color={colors.goldDark} size={17} />
            <Text style={styles.trustText}>
              Every contact unlock is paid through M-Pesa and workers keep
              control of who sees their number.
            </Text>
          </View>

          {/* ---------- Subscription plans (initial design) ---------- */}
          <View style={styles.planCard}>
            <View style={styles.planHead}>
              <Text style={styles.planTitle}>Hire faster</Text>
              {subStatus?.hasSubscription ? (
                <View style={styles.planActivePill}>
                  <Text style={styles.planActiveText}>Active</Text>
                </View>
              ) : null}
            </View>

            {subStatus?.hasSubscription ? (
              <Text style={styles.planActiveCopy}>
                {subStatus.planLabel} · active until{" "}
                {formatExpiry(subStatus.expiresAt)}.
              </Text>
            ) : (
              <>
                <Text style={styles.planCopy}>
                  Chat with maids and post jobs from one weekly bundle.
                </Text>
                <View style={styles.planRow}>
                  {PLAN_TILES.map((plan) => (
                    <Pressable
                      key={plan.id}
                      accessibilityRole="button"
                      android_ripple={{ color: withAlpha(colors.brand, 0.08) }}
                      style={({ pressed }) => [
                        styles.planTile,
                        plan.best && styles.planTileBest,
                        pressed && styles.pressedDim,
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
                  Just one thing? A chat unlock is KES 150 on any maid's
                  profile and a standard job post is KES 300.
                </Text>
              </>
            )}
          </View>
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
  /* ---- Shell ---- */
  safeArea: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  bodyScroll: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  body: {
    paddingBottom: 40,
  },
  pressedDim: {
    opacity: 0.88,
  },
  tilePressed: {
    opacity: 0.9,
  },

  /* ---- Hero ---- */
  hero: {
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 24,
    overflow: "hidden",
    backgroundColor: colors.cream,
  },
  orb1: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: withAlpha(colors.brand, 0.07),
    top: -110,
    right: -90,
  },
  orb2: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: withAlpha(colors.gold, 0.1),
    top: 40,
    left: -70,
  },
  orb3: {
    position: "absolute",
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: withAlpha(colors.brand, 0.05),
    bottom: -20,
    right: 30,
  },
  kicker: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 2,
    marginBottom: 12,
  },
  karibu: {
    color: colors.ink,
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: -0.9,
    lineHeight: 36,
    marginBottom: 8,
  },
  lede: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "500",
    maxWidth: "94%",
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
    maxWidth: "100%",
    marginTop: 18,
    paddingVertical: 4,
    paddingRight: 6,
    borderRadius: 999,
  },
  locationIconChip: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: withAlpha(colors.brand, 0.1),
    alignItems: "center",
    justifyContent: "center",
  },
  locationText: {
    flexShrink: 1,
    color: colors.ink,
    fontSize: 13,
    fontWeight: "700",
  },
  locationChange: {
    color: colors.brand,
    fontSize: 12.5,
    fontWeight: "800",
    marginLeft: 2,
  },

  /* ---- Content column ---- */
  content: {
    paddingHorizontal: 20,
    paddingTop: 4,
  },

  /* ---- Search ---- */
  searchCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: 18,
    minHeight: 54,
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: withAlpha(colors.ink, 0.04),
    shadowColor: colors.ink,
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  searchText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "600",
    flex: 1,
  },

  /* ---- Primary CTAs (initial design) ---- */
  ctaRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 26,
  },
  postJob: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 16,
    minHeight: 54,
    paddingHorizontal: 14,
  },
  ctaPrimary: {
    flex: 1.15,
    backgroundColor: colors.brand,
  },
  postJobText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: "800",
  },
  findMaid: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 16,
    minHeight: 54,
    paddingHorizontal: 14,
  },
  ctaSecondary: {
    flex: 1,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.brand,
  },
  findMaidText: {
    color: colors.brand,
    fontSize: 15,
    fontWeight: "800",
  },

  /* ---- Sections ---- */
  sectionHead: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginBottom: 12,
    marginTop: 4,
  },
  sectionHeadLeft: {
    flex: 1,
    marginRight: 12,
  },
  sectionHeadRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingBottom: 1,
  },
  eyebrow: {
    color: colors.goldDark,
    fontSize: 10.5,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 3,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 17.5,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  seeAllHit: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 10,
  },
  seeAll: {
    color: colors.brand,
    fontSize: 12.5,
    fontWeight: "800",
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: colors.brand,
    borderRadius: 12,
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
    marginBottom: 24,
    gap: 8,
  },

  /* ---- Category chips ---- */
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: withAlpha(colors.brand, 0.07),
    borderRadius: 999,
    paddingLeft: 13,
    paddingRight: 15,
    paddingVertical: 9,
    gap: 7,
  },
  categoryChipPressed: {
    backgroundColor: withAlpha(colors.brand, 0.14),
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
    marginBottom: 24,
    gap: 12,
  },

  /* ============================================================
     Card #1 — Maids near you: POSTER (reverted)
     ============================================================ */
  nearCard: {
    width: 204,
    backgroundColor: colors.white,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: withAlpha(colors.ink, 0.05),
    overflow: "hidden",
    shadowColor: colors.ink,
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  nearPhotoWrap: {
    position: "relative",
  },
  nearPhoto: {
    width: "100%",
    height: 124,
    backgroundColor: withAlpha(colors.brand, 0.14),
  },
  nearPhotoText: {
    color: colors.brand,
    fontSize: 32,
    fontWeight: "800",
  },
  nearVerifiedBadge: {
    position: "absolute",
    top: 10,
    left: 10,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.ink,
    shadowOpacity: 0.18,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  nearDistancePill: {
    position: "absolute",
    bottom: 10,
    right: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: withAlpha(colors.ink, 0.72),
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  nearDistanceText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  nearBody: {
    padding: 13,
  },
  nearName: {
    color: colors.ink,
    fontSize: 14.5,
    fontWeight: "800",
    letterSpacing: -0.1,
  },
  nearServices: {
    color: colors.textMuted,
    fontSize: 11.5,
    fontWeight: "600",
    marginTop: 3,
  },
  nearFooter: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: withAlpha(colors.ink, 0.06),
  },
  nearRate: {
    color: colors.brand,
    fontSize: 13,
    fontWeight: "800",
  },
  nearLocation: {
    flex: 1,
    color: colors.textMuted,
    fontSize: 11.5,
    fontWeight: "600",
    marginLeft: 4,
  },

  /* ============================================================
     Card #2 — Top rated: HORIZONTAL SPLIT (with rank badge)
     ============================================================ */
  topCard: {
    width: 292,
    flexDirection: "row",
    alignItems: "stretch",
    backgroundColor: colors.white,
    borderRadius: 22,
    padding: 10,
    gap: 12,
    borderWidth: 1,
    borderColor: withAlpha(colors.ink, 0.05),
    shadowColor: colors.ink,
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  topPhotoWrap: {
    position: "relative",
  },
  topPhoto: {
    width: 100,
    height: 100,
    borderRadius: 16,
    backgroundColor: withAlpha(colors.brand, 0.14),
  },
  topPhotoText: {
    color: colors.brand,
    fontSize: 32,
    fontWeight: "800",
  },
  topRankBadge: {
    position: "absolute",
    top: 6,
    left: 6,
    backgroundColor: colors.ink,
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
    shadowColor: colors.ink,
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  topRankText: {
    color: colors.gold,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  topVerifyDot: {
    position: "absolute",
    bottom: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.white,
  },
  topInfo: {
    flex: 1,
    justifyContent: "space-between",
    paddingVertical: 2,
    paddingRight: 2,
  },
  topName: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  topServices: {
    color: colors.textMuted,
    fontSize: 11.5,
    lineHeight: 15,
    fontWeight: "600",
    marginTop: 2,
  },
  topDivider: {
    height: 1,
    backgroundColor: withAlpha(colors.ink, 0.06),
    marginVertical: 6,
  },
  topMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  topRate: {
    flexShrink: 1,
    color: colors.brand,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: -0.1,
  },
  topExpChip: {
    backgroundColor: withAlpha(colors.brand, 0.09),
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  topExpChipText: {
    color: colors.brand,
    fontSize: 10.5,
    fontWeight: "800",
    letterSpacing: 0.1,
  },

  /* ============================================================
     Card #3 — Verified: GOLD RIBBON CERTIFICATE
     ============================================================ */
  verifiedCard: {
    width: 158,
    backgroundColor: colors.white,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: withAlpha(colors.gold, 0.5),
    overflow: "hidden",
    shadowColor: colors.ink,
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  verifiedRibbon: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    backgroundColor: withAlpha(colors.gold, 0.18),
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: withAlpha(colors.gold, 0.3),
  },
  verifiedRibbonText: {
    color: colors.goldDark,
    fontSize: 9.5,
    fontWeight: "800",
    letterSpacing: 1.3,
  },
  verifiedBody: {
    padding: 14,
    alignItems: "center",
  },
  verifiedAvatarRing: {
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 2,
    borderColor: withAlpha(colors.gold, 0.5),
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
    backgroundColor: colors.white,
  },
  verifiedAvatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: withAlpha(colors.gold, 0.14),
    overflow: "hidden",
  },
  verifiedAvatarText: {
    color: colors.goldDark,
    fontSize: 20,
    fontWeight: "800",
  },
  verifiedName: {
    color: colors.ink,
    fontSize: 13.5,
    fontWeight: "800",
    letterSpacing: -0.1,
    maxWidth: "100%",
  },
  verifiedExp: {
    color: colors.textMuted,
    fontSize: 10.5,
    fontWeight: "700",
    marginTop: 4,
  },
  verifiedSpacer: {
    height: 15,
    marginTop: 4,
  },
  verifiedRate: {
    color: colors.goldDark,
    fontSize: 12.5,
    fontWeight: "800",
    marginTop: 10,
  },
  verifiedDistance: {
    color: colors.textFaint,
    fontSize: 10,
    fontWeight: "600",
    marginTop: 2,
  },

<<<<<<< HEAD
  /* ---- Loading ---- */
  loadingBox: {
    paddingVertical: 34,
    alignItems: "center",
=======
  /* ---- Featured promo: boost a job — gold alpha-border card ----
     boostShadow carries elevation on an OPAQUE fill; boostStrip keeps the
     translucent gold fill + 1px alpha border elevation-free so the border
     renders true and no dark silhouette bleeds through the tint. */
  boostShadow: {
    borderRadius: 20,
    marginBottom: 16,
    backgroundColor: colors.white,
    shadowColor: colors.ink,
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 1,
>>>>>>> d830733d38ef2b743840de3012addd3fe4c1e61c
  },

  /* ---- Featured promo (dark) ---- */
  promoCard: {
    backgroundColor: colors.ink,
    borderRadius: 24,
    padding: 18,
    marginTop: 4,
    marginBottom: 20,
    overflow: "hidden",
    shadowColor: colors.ink,
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  promoTopRow: {
    flexDirection: "row",
    alignItems: "center",
<<<<<<< HEAD
    gap: 10,
    marginBottom: 12,
  },
  promoBadge: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: withAlpha(colors.gold, 0.18),
=======
    backgroundColor: withAlpha(colors.gold, 0.1),
    borderWidth: 1,
    borderColor: withAlpha(colors.gold, 0.35),
    borderRadius: 20,
    paddingVertical: 14,
    paddingLeft: 16,
    paddingRight: 14,
    gap: 12,
  },
  boostBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: withAlpha(colors.gold, 0.16),
    borderWidth: 1,
    borderColor: withAlpha(colors.gold, 0.32),
>>>>>>> d830733d38ef2b743840de3012addd3fe4c1e61c
    alignItems: "center",
    justifyContent: "center",
  },
  promoEyebrow: {
    color: colors.gold,
    fontSize: 10,
    fontWeight: "800",
<<<<<<< HEAD
    letterSpacing: 1.6,
=======
    letterSpacing: 1.4,
    textTransform: "uppercase",
    marginBottom: 2,
>>>>>>> d830733d38ef2b743840de3012addd3fe4c1e61c
  },
  promoTitle: {
    color: colors.white,
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.4,
    marginBottom: 6,
  },
  promoCopy: {
    color: withAlpha(colors.white, 0.72),
    fontSize: 12.5,
    lineHeight: 19,
    fontWeight: "500",
  },
  promoCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
    backgroundColor: colors.gold,
    borderRadius: 14,
    minHeight: 44,
    paddingHorizontal: 18,
    marginTop: 14,
  },
  promoCtaText: {
    color: colors.ink,
<<<<<<< HEAD
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.1,
=======
    fontSize: 15.5,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  boostCopy: {
    color: colors.textMuted,
    fontSize: 11.5,
    lineHeight: 16,
    fontWeight: "600",
    marginTop: 3,
>>>>>>> d830733d38ef2b743840de3012addd3fe4c1e61c
  },

  /* ---- How it works ---- */
  stepsCard: {
    backgroundColor: colors.white,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: withAlpha(colors.ink, 0.04),
    paddingVertical: 6,
    paddingHorizontal: 16,
    marginBottom: 16,
    shadowColor: colors.ink,
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
  },
  stepDivided: {
    borderTopWidth: 1,
    borderTopColor: colors.mist,
  },
  stepNumWrap: {
    width: 38,
    alignItems: "flex-start",
    marginRight: 12,
  },
  stepNum: {
    color: colors.cloud,
    fontSize: 32,
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

  /* ---- Trust ---- */
  trustCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: withAlpha(colors.brand, 0.07),
    borderRadius: 18,
    padding: 14,
    gap: 10,
    marginBottom: 14,
  },
  trustText: {
    flex: 1,
    color: colors.brand,
    fontSize: 12,
    lineHeight: 17.5,
    fontWeight: "600",
  },

  /* ---- Subscription plans (initial design) ---- */
  planCard: {
    backgroundColor: colors.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.mist,
    padding: 16,
    marginTop: 14,
    shadowColor: colors.ink,
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
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
    marginBottom: 14,
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