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
import Chip from "../../components/ui/Chip";
import SignedImage from "../../components/media/SignedImage";
import { formatDistance } from "../../utils/geo";
import {
  SERVICE_OPTIONS,
  availabilityLabel,
  serviceLabel,
} from "../../utils/workerMeta";
import { colors, withAlpha } from "../../theme/colors";

// List virtualization + lazy loading (2026-10-20 perf round).
// The server pages with limit/offset; hasMore = last page came back full.
const PAGE_SIZE = 20;

export default function FindHelpScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  // Deep-link from the employer home category tiles: Maids tab opens with
  // that service preselected (params merge on every navigate).
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

  // Employer coords via ref — always current, never a re-fetch dependency
  // (a location change lands on the next load/refresh, same as home).
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
        // Coords ride along on every load so each row can show its
        // distance; sort=near only when the "Near me" filter is on.
        ...(coords
          ? { lat: coords.lat, lng: coords.lng, sort: nearOnly ? "near" : undefined }
          : {}),
      });
      const page = data.workers || [];

      setWorkers(page);
      setHasMore(page.length === PAGE_SIZE);
    } catch (err) {
      setError(
        err?.message || "Could not load workers. Pull down to try again."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  // Scroll-end pagination — appends the next page with the SAME service /
  // query the current list was loaded with.
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
      // Quiet failure: keep the loaded rows, allow retrying on next scroll-end.
    } finally {
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service, nearOnly]);

  const onRefresh = useCallback(() => load({ refresh: true }), [service, query]);

  // Stable renderItem — the row component is memoized, so list state updates
  // (pagination appends) only re-render the rows whose worker data changed.
  const renderItem = useCallback(
    ({ item }) => <WorkerCard worker={item} />,
    []
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.cream} />

      <View style={styles.headerBlock}>
        <Text style={styles.title}>Find Help</Text>
        <Text style={styles.subtitle}>
          Trusted domestic workers near you, verified by their community.
        </Text>

        <TextInput
          style={styles.search}
          placeholder="Search name, skill or area…"
          placeholderTextColor={colors.textMuted}
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => load()}
          returnKeyType="search"
          autoCapitalize="none"
        />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
        >
          {hasCoords ? (
            <Chip
              label="Near me"
              selected={nearOnly}
              onPress={() => setNearOnly((v) => !v)}
            />
          ) : null}
          <Chip
            label="All"
            selected={service === ""}
            onPress={() => setService("")}
          />
          {SERVICE_OPTIONS.map((option) => (
            <Chip
              key={option.value}
              label={option.label}
              selected={service === option.value}
              onPress={() => setService(option.value)}
            />
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.brand} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>Something went wrong</Text>
          <Text style={styles.emptyText}>{error}</Text>
        </View>
      ) : workers.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>No workers yet</Text>
          <Text style={styles.emptyText}>
            Worker profiles will appear here as domestic workers complete them.
            Try clearing your search.
          </Text>
        </View>
      ) : (
        <FlatList
          data={workers}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          renderItem={renderItem}
          // Lazy loading: render a small first window, top up in small
          // batches, and keep a moderate render window as the list grows.
          initialNumToRender={8}
          maxToRenderPerBatch={6}
          windowSize={7}
          removeClippedSubviews
          onEndReached={loadMore}
          onEndReachedThreshold={0.35}
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footerSpinner}>
                <ActivityIndicator color={colors.brand} />
              </View>
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
}

// Memoized row: only re-renders when its worker object changes (new fetch /
// page append). Navigation happens inside the card so the memo contract is
// just `worker` — no per-render onPress closures to break it.
const WorkerCard = React.memo(function WorkerCard({ worker }) {
  const navigation = useNavigation();
  const firstName = (worker.name || "").split(" ")[0] || "?";
  const kycVerified = worker.kycStatus === "verified";

  const onPress = useCallback(
    () => navigation.navigate("WorkerProfile", { workerId: worker.id }),
    [navigation, worker.id]
  );

  return (
    <Pressable style={styles.card} onPress={onPress}>
      <SignedImage
        url={worker.avatarUrl}
        mediaId={worker.avatarMediaId}
        variant="thumb"
        fallbackText={firstName}
        style={styles.avatar}
        textStyle={styles.avatarText}
      />

      <View style={styles.cardMain}>
        <View style={styles.nameRow}>
          <Text style={styles.cardName} numberOfLines={1}>
            {worker.name}
          </Text>
          {kycVerified ? (
            <View style={styles.verifiedBadge}>
              <Text style={styles.verifiedText}>Verified</Text>
            </View>
          ) : null}
        </View>

        <Text style={styles.cardTitle} numberOfLines={1}>
          {worker.title || "Domestic worker"}
        </Text>

        <View style={styles.metaRow}>
          {formatDistance(worker.distanceKm) ? (
            <Text style={styles.distanceText}>
              {formatDistance(worker.distanceKm)}
            </Text>
          ) : null}
          {worker.locationLabel ? (
            <Text style={styles.metaText} numberOfLines={1}>
              {formatDistance(worker.distanceKm) ? " · " : ""}
              {worker.locationLabel}
            </Text>
          ) : null}
          {worker.availability ? (
            <Text style={styles.metaText}>
              · {availabilityLabel(worker.availability)}
            </Text>
          ) : null}
        </View>

        {worker.services.length > 0 ? (
          <Text style={styles.servicesText} numberOfLines={1}>
            {worker.services.map(serviceLabel).join(" · ")}
          </Text>
        ) : null}
      </View>

      <View style={styles.rateBox}>
        {worker.hourlyRate !== null ? (
          <>
            <Text style={styles.rateValue}>KES {worker.hourlyRate}</Text>
            <Text style={styles.rateUnit}>/hr</Text>
          </>
        ) : (
          <Text style={styles.rateUnit}>Rate on ask</Text>
        )}
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  headerBlock: {
    paddingHorizontal: 22,
    paddingTop: 10,
  },
  title: {
    color: colors.ink,
    fontSize: 25,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 13.5,
    lineHeight: 20,
    marginTop: 4,
    marginBottom: 14,
  },
  search: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.mistDark,
    borderRadius: 12,
    minHeight: 46,
    paddingHorizontal: 14,
    fontSize: 14.5,
    color: colors.ink,
    marginBottom: 12,
  },
  chipsRow: {
    paddingRight: 22,
  },
  list: {
    padding: 22,
    paddingTop: 8,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.mist,
    padding: 14,
    marginBottom: 12,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: withAlpha(colors.brand, 0.14),
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    overflow: "hidden",
  },
  avatarText: {
    color: colors.brand,
    fontSize: 19,
    fontWeight: "800",
  },
  cardMain: {
    flex: 1,
    marginRight: 8,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  cardName: {
    flexShrink: 1,
    color: colors.ink,
    fontSize: 15,
    fontWeight: "800",
    marginRight: 6,
  },
  verifiedBadge: {
    backgroundColor: withAlpha(colors.brand, 0.14),
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  verifiedText: {
    color: colors.brand,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  cardTitle: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "600",
    marginTop: 2,
  },
  metaRow: {
    flexDirection: "row",
    marginTop: 2,
  },
  metaText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "600",
  },
  distanceText: {
    color: colors.brand,
    fontSize: 12,
    fontWeight: "800",
  },
  servicesText: {
    color: colors.textFaint,
    fontSize: 11.5,
    fontWeight: "600",
    marginTop: 4,
  },
  rateBox: {
    alignItems: "flex-end",
  },
  rateValue: {
    color: colors.brand,
    fontSize: 14,
    fontWeight: "800",
  },
  rateUnit: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  footerSpinner: {
    paddingVertical: 18,
  },
  emptyTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 6,
    textAlign: "center",
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 13.5,
    lineHeight: 20,
    textAlign: "center",
  },
});
