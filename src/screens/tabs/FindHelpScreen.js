import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";

import { useAuth } from "../../context/AuthContext";
import { listWorkers } from "../../services/workersService";
import EmptyState from "../../components/ui/EmptyState";
import SignedImage from "../../components/media/SignedImage";
import TabBarIcon from "../../components/ui/TabBarIcon";
import { formatDistance } from "../../utils/geo";
import { SERVICE_OPTIONS, serviceLabel } from "../../utils/workerMeta";
import { colors, withAlpha } from "../../theme/colors";

const PAGE_SIZE = 20;

const FilterTab = React.memo(function FilterTab({ label, selected, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      style={({ pressed }) => [styles.tabItem, pressed && styles.pressedDim]}
    >
      <Text style={[styles.tabLabel, selected && styles.tabLabelOn]}>
        {label}
      </Text>
      <View style={[styles.tabRule, selected && styles.tabRuleOn]} />
    </Pressable>
  );
});

export default function FindHelpScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { params } = useRoute();

  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [service, setService] = useState("");
  const [nearOnly, setNearOnly] = useState(false);

  const coordsRef = useRef(null);
  if (
    typeof user?.locationLat === "number" &&
    typeof user?.locationLng === "number"
  ) {
    coordsRef.current = { lat: user.locationLat, lng: user.locationLng };
  }
  const hasCoords = Boolean(coordsRef.current);

  useEffect(() => {
    if (params?.service !== undefined && params.service !== null) {
      setService(params.service);
    }
  }, [params?.service]);

  async function load({ refresh = false } = {}) {
    setError("");
    if (refresh) setRefreshing(true);
    else setLoading(true);

    try {
      const coords = coordsRef.current;
      const data = await listWorkers({
        service,
        query: query.trim(),
        limit: PAGE_SIZE,
        offset: 0,
        ...(coords
          ? { lat: coords.lat, lng: coords.lng, sort: nearOnly ? "near" : undefined }
          : {}),
      });
      const page = data.workers || [];
      setWorkers(page);
      setHasMore(page.length === PAGE_SIZE);
    } catch (err) {
      setError(err?.message || "Could not load workers. Pull down to try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function loadMore() {
    if (loading || loadingMore || refreshing || !hasMore) return;
    setLoadingMore(true);

    try {
      const coords = coordsRef.current;
      const data = await listWorkers({
        service,
        query: query.trim(),
        limit: PAGE_SIZE,
        offset: workers.length,
        ...(coords
          ? { lat: coords.lat, lng: coords.lng, sort: nearOnly ? "near" : undefined }
          : {}),
      });
      const page = data.workers || [];
      setWorkers((prev) => {
        const seen = new Set(prev.map((w) => w.id));
        return [...prev, ...page.filter((w) => !seen.has(w.id))];
      });
      setHasMore(page.length === PAGE_SIZE);
    } catch (err) {
      // Quiet failure: keep loaded rows.
    } finally {
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service, nearOnly]);

  const onRefresh = useCallback(() => load({ refresh: true }), [service, query]);

  const renderItem = useCallback(
    ({ item }) => <WorkerCard worker={item} />,
    []
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.cream} />

      {/* ---------- Flat sage top panel (square edges) ---------- */}
      <View style={styles.topPanel}>
        <View style={styles.orb1} />
        <View style={styles.orb2} />
        <View style={styles.orb3} />

        <View style={styles.topInner}>
          <Text style={styles.kicker}>EMPLOYER · FIND HELP</Text>
          <Text style={styles.title}>Find Help</Text>
          <Text style={styles.subtitle}>
            Trusted domestic workers near you — verified by their community.
          </Text>

          {/* Filled (darker) search */}
          <View style={styles.searchWrap}>
            <TabBarIcon name="search" color={colors.textMuted} size={16} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search name, skill or area…"
              placeholderTextColor={colors.textFaint}
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={() => load()}
              returnKeyType="search"
              autoCapitalize="none"
            />
          </View>

          {/* Underline tabs */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabsRow}
          >
            {hasCoords ? (
              <FilterTab
                label="Near me"
                selected={nearOnly}
                onPress={() => setNearOnly((v) => !v)}
              />
            ) : null}
            <FilterTab
              label="All"
              selected={service === ""}
              onPress={() => setService("")}
            />
            {SERVICE_OPTIONS.map((option) => (
              <FilterTab
                key={option.value}
                label={option.label}
                selected={service === option.value}
                onPress={() => setService(option.value)}
              />
            ))}
          </ScrollView>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.brand} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <EmptyState
            icon="alert-triangle"
            tone="danger"
            title="Something went wrong"
            body={error}
          />
        </View>
      ) : workers.length === 0 ? (
        <View style={styles.center}>
          <EmptyState
            icon="users"
            tone="brand"
            title="No workers yet"
            body="Worker profiles will appear here as domestic workers complete them. Try clearing your search."
          />
        </View>
      ) : (
        <FlatList
          data={workers}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.brand}
              colors={[colors.brand]}
            />
          }
          renderItem={renderItem}
          initialNumToRender={6}
          maxToRenderPerBatch={5}
          windowSize={7}
          removeClippedSubviews
          onEndReached={loadMore}
          onEndReachedThreshold={0.35}
          ListHeaderComponent={
            <View style={styles.resultsBar}>
              <Text style={styles.resultsCount}>
                {workers.length}
                {hasMore ? "+" : ""}{" "}
                {workers.length === 1 ? "profile" : "profiles"}
              </Text>
              <Text style={styles.resultsSort}>
                {nearOnly ? "Sorted · Near" : "Sorted · Recommended"}
              </Text>
            </View>
          }
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footerSpinner}>
                <ActivityIndicator color={colors.brand} />
              </View>
            ) : !hasMore && workers.length > 0 ? (
              <View style={styles.endMark}>
                <View style={styles.endRule} />
                <Text style={styles.endText}>END OF RESULTS</Text>
                <View style={styles.endRule} />
              </View>
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
}

const WorkerCard = React.memo(function WorkerCard({ worker }) {
  const navigation = useNavigation();
  const firstName = (worker.name || "").split(" ")[0] || "?";
  const featured = Boolean(worker.featured);
  const kycVerified = worker.kycStatus === "verified";
  const distanceLabel = formatDistance(worker.distanceKm);
  const servicesText = (worker.services || []).map(serviceLabel).join(" · ");

  const onPress = useCallback(
    () => navigation.navigate("WorkerProfile", { workerId: worker.id }),
    [navigation, worker.id]
  );

  let eyebrowLabel = "PROFILE";
  let eyebrowStyle = styles.eyebrowNeutral;
  if (featured) {
    eyebrowLabel = "FEATURED · BOOSTED";
    eyebrowStyle = styles.eyebrowGold;
  } else if (kycVerified) {
    eyebrowLabel = "VERIFIED · KYC";
    eyebrowStyle = styles.eyebrowBrand;
  }

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      android_ripple={{ color: withAlpha(colors.brand, 0.06) }}
      onPress={onPress}
    >
      <View style={styles.cardTop}>
        <View style={styles.photoWrap}>
          <SignedImage
            url={worker.avatarUrl}
            mediaId={worker.avatarMediaId}
            variant="thumb"
            fallbackText={firstName}
            style={styles.photo}
            textStyle={styles.photoText}
          />
          {featured ? (
            <View style={[styles.cornerBadge, styles.cornerGold]}>
              <TabBarIcon name="zap" color={colors.ink} size={9} />
            </View>
          ) : kycVerified ? (
            <View style={[styles.cornerBadge, styles.cornerBrand]}>
              <TabBarIcon name="check" color={colors.white} size={9} />
            </View>
          ) : null}
        </View>

        <View style={styles.infoCol}>
          <Text style={[styles.eyebrow, eyebrowStyle]} numberOfLines={1}>
            {eyebrowLabel}
          </Text>
          <Text style={styles.name} numberOfLines={1}>
            {worker.name}
          </Text>
          <Text style={styles.role} numberOfLines={1}>
            {worker.title || "Domestic worker"}
          </Text>

          <View style={styles.factsRow}>
            <View style={styles.fact}>
              <Text style={styles.factLabel}>DISTANCE</Text>
              <Text style={styles.factValue} numberOfLines={1}>
                {distanceLabel || "—"}
              </Text>
            </View>
            <View style={styles.factRule} />
            <View style={styles.fact}>
              <Text style={styles.factLabel}>RATE</Text>
              <Text style={styles.factValue} numberOfLines={1}>
                {worker.hourlyRate !== null
                  ? `KES ${worker.hourlyRate}`
                  : "On ask"}
              </Text>
            </View>
            <View style={styles.factRule} />
            <View style={styles.fact}>
              <Text style={styles.factLabel}>STATUS</Text>
              <Text style={styles.factValue} numberOfLines={1}>
                {featured ? "Featured" : kycVerified ? "Verified" : "New"}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {servicesText ? (
        <>
          <View style={styles.dividerRow}>
            <View style={styles.dividerDot} />
            <View style={styles.dividerDash} />
            <View style={styles.dividerDot} />
          </View>
          <View style={styles.servicesStrip}>
            <Text style={styles.servicesLabel}>SERVICES</Text>
            <Text style={styles.servicesValue} numberOfLines={1}>
              {servicesText}
            </Text>
          </View>
        </>
      ) : null}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  pressedDim: {
    opacity: 0.88,
  },

  /* ============================================================
     Flat sage top panel — square edges, no shadow, no border.
     ============================================================ */
  topPanel: {
    backgroundColor: colors.mist,
    overflow: "hidden",
  },
  topInner: {
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 4,
  },

  orb1: {
    position: "absolute",
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: withAlpha(colors.brand, 0.1),
    top: -120,
    right: -80,
  },
  orb2: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: withAlpha(colors.gold, 0.14),
    top: 40,
    left: -60,
  },
  orb3: {
    position: "absolute",
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: withAlpha(colors.brand, 0.07),
    bottom: -30,
    right: 30,
  },

  kicker: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 2,
    marginBottom: 10,
  },
  title: {
    color: colors.ink,
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: -0.9,
    lineHeight: 36,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "500",
    marginTop: 6,
    maxWidth: "94%",
  },

  /* ---- Filled (darker) search ---- */
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    minHeight: 48,
    marginTop: 16,
    borderRadius: 14,
    backgroundColor: withAlpha(colors.ink, 0.08),
  },
  searchInput: {
    flex: 1,
    minHeight: 46,
    fontSize: 14.5,
    fontWeight: "500",
    color: colors.ink,
    paddingVertical: 0,
  },

  /* ---- Underline tabs ---- */
  tabsRow: {
    gap: 22,
    paddingTop: 8,
  },
  tabItem: {
    paddingTop: 12,
    paddingBottom: 0,
    alignItems: "center",
  },
  tabLabel: {
    color: colors.textMuted,
    fontSize: 13.5,
    fontWeight: "600",
    letterSpacing: -0.1,
    paddingBottom: 10,
  },
  tabLabelOn: {
    color: colors.ink,
    fontWeight: "800",
  },
  tabRule: {
    height: 2,
    alignSelf: "stretch",
    borderRadius: 2,
    backgroundColor: "transparent",
  },
  tabRuleOn: {
    backgroundColor: colors.brand,
  },

  /* ---- Results bar ---- */
  resultsBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 6,
    paddingBottom: 12,
  },
  resultsCount: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  resultsSort: {
    color: colors.textFaint,
    fontSize: 10.5,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },

  list: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 28,
  },

  /* ============================================================
     ID badge card (unchanged)
     ============================================================ */
  card: {
    backgroundColor: colors.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: withAlpha(colors.ink, 0.05),
    padding: 12,
    marginBottom: 12,
    shadowColor: colors.ink,
    shadowOpacity: 0.07,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  cardPressed: {
    opacity: 0.9,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
  },
  photoWrap: {
    position: "relative",
    marginRight: 14,
  },
  photo: {
    width: 78,
    height: 94,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: withAlpha(colors.brand, 0.12),
  },
  photoText: {
    color: colors.brand,
    fontSize: 26,
    fontWeight: "800",
  },
  cornerBadge: {
    position: "absolute",
    bottom: -3,
    right: -3,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.white,
    shadowColor: colors.ink,
    shadowOpacity: 0.18,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  cornerGold: {
    backgroundColor: colors.gold,
  },
  cornerBrand: {
    backgroundColor: colors.brand,
  },
  infoCol: {
    flex: 1,
  },
  eyebrow: {
    fontSize: 9.5,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 3,
  },
  eyebrowNeutral: {
    color: colors.textFaint,
  },
  eyebrowBrand: {
    color: colors.brand,
  },
  eyebrowGold: {
    color: colors.goldDark,
  },
  name: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  role: {
    color: colors.textMuted,
    fontSize: 12.5,
    fontWeight: "600",
    marginTop: 2,
  },
  factsRow: {
    flexDirection: "row",
    alignItems: "stretch",
    marginTop: 12,
  },
  fact: {
    flex: 1,
    justifyContent: "center",
  },
  factLabel: {
    color: colors.textFaint,
    fontSize: 8.5,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 3,
  },
  factValue: {
    color: colors.ink,
    fontSize: 12.5,
    fontWeight: "800",
    letterSpacing: -0.1,
  },
  factRule: {
    width: 1,
    backgroundColor: withAlpha(colors.ink, 0.08),
    marginHorizontal: 8,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    marginHorizontal: -12,
    paddingHorizontal: 12,
  },
  dividerDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: withAlpha(colors.ink, 0.2),
  },
  dividerDash: {
    flex: 1,
    height: 0,
    borderTopWidth: 1,
    borderTopColor: withAlpha(colors.ink, 0.16),
    borderStyle: "dashed",
    marginHorizontal: 8,
  },
  servicesStrip: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 10,
    gap: 10,
  },
  servicesLabel: {
    color: colors.textFaint,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  servicesValue: {
    flex: 1,
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "600",
  },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  footerSpinner: {
    paddingVertical: 20,
    alignItems: "center",
  },
  endMark: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 18,
  },
  endRule: {
    flex: 1,
    height: 1,
    backgroundColor: withAlpha(colors.ink, 0.08),
  },
  endText: {
    color: colors.textFaint,
    fontSize: 9.5,
    fontWeight: "800",
    letterSpacing: 1.4,
  },
});