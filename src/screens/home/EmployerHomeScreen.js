import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
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
import { HelpNestLogoMark } from "../../components/Logo";
import SignedImage from "../../components/media/SignedImage";
import LocationPromptCard from "../../components/ui/LocationPromptCard";
import Chip from "../../components/ui/Chip";
import TabBarIcon from "../../components/ui/TabBarIcon";
import {
  SERVICE_OPTIONS,
  availabilityLabel,
  serviceLabel,
} from "../../utils/workerMeta";
import { colors, withAlpha } from "../../theme/colors";

// Employer home (PRD §5.1) — 2026-10-20 layout round:
//   search -> Post a job CTA -> category chips -> location nudge ->
//   Maids near you (carousel) -> Top rated (carousel) -> How it works ->
//   trust note.
//
// One workers fetch per focus feeds BOTH carousels client-side:
//   - "near you" = workers whose area overlaps the employer's saved area
//     (token match on the location label — coarse on purpose, MVP geo)
//   - "top rated" = verified first, then most experienced
// No ratings exist yet, so "top rated" ranks by what we can defend.

const CAROUSEL_FETCH = 40; // one page, plenty for two 6-item rails
const RAIL_SIZE = 6;

// Memoized rail cards — navigation lives inside so the memo contract stays
// a single `worker` prop (same pattern as the Maids list rows).
const NearbyMaidCard = React.memo(function NearbyMaidCard({ worker }) {
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
      style={({ pressed }) => [styles.nearCard, pressed && styles.tilePressed]}
      onPress={onPress}
    >
      <SignedImage
        url={worker.avatarUrl}
        mediaId={worker.avatarMediaId}
        variant="thumb"
        fallbackText={firstName}
        style={styles.nearAvatar}
        textStyle={styles.nearAvatarText}
      />

      <View style={styles.nearMain}>
        <View style={styles.nameRow}>
          <Text style={styles.nearName} numberOfLines={1}>
            {worker.name}
          </Text>
          {verified ? (
            <View style={styles.verifiedBadge}>
              <TabBarIcon name="check" color={colors.white} size={9} />
            </View>
          ) : null}
        </View>

        <Text style={styles.nearServices} numberOfLines={1}>
          {(worker.services || []).map(serviceLabel).join(" · ") || "Domestic worker"}
        </Text>

        <View style={styles.nearMetaRow}>
          {worker.hourlyRate !== null ? (
            <Text style={styles.nearRate}>KES {worker.hourlyRate}/hr</Text>
          ) : (
            <Text style={styles.nearRate}>Rate on ask</Text>
          )}
          {worker.locationLabel ? (
            <Text style={styles.nearArea} numberOfLines={1}>
              · {worker.locationLabel}
            </Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
});

const TopMaidCard = React.memo(function TopMaidCard({ worker }) {
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
      style={({ pressed }) => [styles.topCard, pressed && styles.tilePressed]}
      onPress={onPress}
    >
      <SignedImage
        url={worker.avatarUrl}
        mediaId={worker.avatarMediaId}
        variant="thumb"
        fallbackText={firstName}
        style={styles.topAvatar}
        textStyle={styles.topAvatarText}
      />
      <Text style={styles.topName} numberOfLines={1}>
        {firstName}
      </Text>
      {verified ? (
        <View style={styles.topVerified}>
          <Text style={styles.topVerifiedText}>ID verified</Text>
        </View>
      ) : (
        <View style={styles.topVerifiedSpacer} />
      )}
      <Text style={styles.topRate}>
        {worker.hourlyRate !== null ? `KES ${worker.hourlyRate}/hr` : "Rate on ask"}
      </Text>
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

  const firstName = (user?.name || "").split(" ")[0] || "";

  // Fresh picks every time the tab regains focus (cheap: one 40-row page).
  useFocusEffect(
    useCallback(() => {
      let active = true;

      listWorkers({ limit: CAROUSEL_FETCH })
        .then((data) => {
          if (active) setWorkers(data.workers || []);
        })
        .catch(() => {
          // Non-fatal on the home screen — the Maids tab shows full errors.
          if (active) setWorkers([]);
        })
        .finally(() => {
          if (active) setLoading(false);
        });

      return () => {
        active = false;
      };
    }, [])
  );

  // Coarse geo: overlap between the employer's saved area and the worker's.
  const near = useMemo(() => {
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
  }, [workers, user?.locationLabel]);

  const top = useMemo(() => {
    return [...workers]
      .sort((a, b) => {
        const va = a.kycStatus === "verified" ? 1 : 0;
        const vb = b.kycStatus === "verified" ? 1 : 0;
        if (va !== vb) return vb - va;
        return (b.experienceYears || 0) - (a.experienceYears || 0);
      })
      .slice(0, RAIL_SIZE);
  }, [workers]);

  const nearTitle = near.matched ? "Maids near you" : "Available now";

  const renderNear = useCallback(({ item }) => <NearbyMaidCard worker={item} />, []);
  const renderTop = useCallback(({ item }) => <TopMaidCard worker={item} />, []);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar barStyle="light-content" backgroundColor={colors.brand} />

      {/* ---------- Brand header ---------- */}
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <View style={styles.logoBadge}>
            <HelpNestLogoMark size={22} />
          </View>
          <Text style={styles.brandText}>HelpNest</Text>
        </View>
        <View style={styles.headerPill}>
          <Text style={styles.headerPillText}>Employer</Text>
        </View>
      </View>

      <ScrollView
        style={styles.bodyScroll}
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.karibu}>Karibu{firstName ? `, ${firstName}` : ""} 👋</Text>
        <Text style={styles.lede}>
          Find trusted domestic workers for your home — verified profiles,
          safe payments.
        </Text>

        {/* ---------- Search entry ---------- */}
        <Pressable
          accessibilityRole="button"
          style={styles.searchCard}
          onPress={() => navigation.navigate("MaidsTab")}
        >
          <TabBarIcon name="search" color={colors.textMuted} size={19} />
          <Text style={styles.searchText}>Search name, skill or area…</Text>
        </Pressable>

        {/* ---------- Post a job CTA ---------- */}
        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [styles.postJob, pressed && styles.tilePressed]}
          onPress={() => navigation.navigate("MyJobsTab")}
        >
          <View style={styles.postJobIcon}>
            <TabBarIcon name="file-text" color={colors.white} size={19} />
          </View>
          <View style={styles.postJobMain}>
            <Text style={styles.postJobTitle}>Post a job</Text>
            <Text style={styles.postJobBody}>
              Describe the help you need once — let matching maids come to you.
            </Text>
          </View>
          <TabBarIcon name="chevron-right" color={colors.cream} size={18} />
        </Pressable>

        {/* ---------- Categories ---------- */}
        <Text style={styles.sectionTitle}>What do you need help with?</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
        >
          {SERVICE_OPTIONS.map((option) => (
            <Chip
              key={option.value}
              label={option.label}
              selected={false}
              onPress={() =>
                navigation.navigate("MaidsTab", { service: option.value })
              }
            />
          ))}
        </ScrollView>

        <LocationPromptCard />

        {/* ---------- Workers ---------- */}
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={colors.brand} />
          </View>
        ) : workers.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>
              No worker profiles yet. They'll appear here as domestic workers
              complete their profiles.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>{nearTitle}</Text>
              <Pressable accessibilityRole="button" onPress={() => navigation.navigate("MaidsTab")}>
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
              <Pressable accessibilityRole="button" onPress={() => navigation.navigate("MaidsTab")}>
                <Text style={styles.seeAll}>See all</Text>
              </Pressable>
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
          </>
        )}

        {/* ---------- How it works ---------- */}
        <Text style={styles.sectionTitle}>How it works</Text>
        <View style={steps.card}>
          {HOW_IT_WORKS.map((step, index) => (
            <View key={step.title} style={styles.stepRow}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepBadgeText}>{index + 1}</Text>
              </View>
              <View style={styles.stepMain}>
                <Text style={styles.stepTitle}>{step.title}</Text>
                <Text style={styles.stepBody}>{step.body}</Text>
              </View>
              <TabBarIcon name={step.icon} color={withAlpha(colors.brand, 0.55)} size={18} />
            </View>
          ))}
        </View>

        {/* ---------- Trust note ---------- */}
        <View style={styles.trustCard}>
          <TabBarIcon name="shield" color={colors.brand} size={17} />
          <Text style={styles.trustText}>
            Every contact unlock is paid through M-Pesa and workers keep
            control of who sees their number.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const steps = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.mist,
    padding: 6,
    marginBottom: 18,
  },
});

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  header: {
    backgroundColor: colors.brand,
    paddingHorizontal: 22,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  logoBadge: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: colors.cream,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  brandText: {
    color: colors.white,
    fontSize: 17,
    fontWeight: "800",
  },
  headerPill: {
    backgroundColor: withAlpha(colors.cream, 0.16),
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  headerPillText: {
    color: colors.cream,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  bodyScroll: {
    flex: 1,
  },
  body: {
    padding: 22,
    paddingBottom: 36,
  },
  karibu: {
    color: colors.ink,
    fontSize: 26,
    fontWeight: "800",
    marginBottom: 6,
  },
  lede: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 18,
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

  /* ---- Post a job ---- */
  postJob: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.brand,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
    marginBottom: 20,
  },
  postJobIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: withAlpha("#FFFFFF", 0.16),
    alignItems: "center",
    justifyContent: "center",
  },
  postJobMain: {
    flex: 1,
  },
  postJobTitle: {
    color: colors.white,
    fontSize: 15,
    fontWeight: "800",
  },
  postJobBody: {
    color: withAlpha("#FFFFFF", 0.82),
    fontSize: 12,
    lineHeight: 16.5,
    marginTop: 2,
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
  seeAll: {
    color: colors.brand,
    fontSize: 13,
    fontWeight: "800",
  },
  chipsRow: {
    paddingRight: 22,
    marginBottom: 16,
    gap: 8,
  },

  /* ---- Rails ---- */
  rail: {
    paddingRight: 22,
    marginBottom: 18,
    gap: 10,
  },
  tilePressed: {
    backgroundColor: colors.cream,
  },

  /* ---- Nearby card ---- */
  nearCard: {
    width: 250,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.mist,
    padding: 12,
  },
  nearAvatar: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: withAlpha(colors.brand, 0.14),
    marginRight: 10,
    overflow: "hidden",
  },
  nearAvatarText: {
    color: colors.brand,
    fontSize: 18,
    fontWeight: "800",
  },
  nearMain: {
    flex: 1,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  nearName: {
    flexShrink: 1,
    color: colors.ink,
    fontSize: 13.5,
    fontWeight: "800",
    marginRight: 6,
  },
  verifiedBadge: {
    width: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  nearServices: {
    color: colors.textFaint,
    fontSize: 11,
    fontWeight: "600",
    marginTop: 2,
  },
  nearMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 3,
  },
  nearRate: {
    color: colors.brand,
    fontSize: 12,
    fontWeight: "800",
  },
  nearArea: {
    flexShrink: 1,
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "600",
  },

  /* ---- Top rated card ---- */
  topCard: {
    width: 132,
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.mist,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: "center",
  },
  topAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: withAlpha(colors.brand, 0.14),
    marginBottom: 8,
    overflow: "hidden",
  },
  topAvatarText: {
    color: colors.brand,
    fontSize: 21,
    fontWeight: "800",
  },
  topName: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "800",
    maxWidth: "100%",
  },
  topVerified: {
    backgroundColor: withAlpha(colors.brand, 0.13),
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
    marginTop: 4,
  },
  topVerifiedText: {
    color: colors.brand,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  topVerifiedSpacer: {
    height: 15,
    marginTop: 4,
  },
  topRate: {
    color: colors.textMuted,
    fontSize: 11.5,
    fontWeight: "700",
    marginTop: 5,
  },

  /* ---- Steps ---- */
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
});
