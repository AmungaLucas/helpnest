import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
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
import LocationPromptCard from "../../components/ui/LocationPromptCard";
import TabBarIcon from "../../components/ui/TabBarIcon";
import {
  SERVICE_OPTIONS,
  availabilityLabel,
  serviceLabel,
} from "../../utils/workerMeta";
import { colors, withAlpha } from "../../theme/colors";

// Employer home (PRD §5.1): quick paths into finding and hiring help.
export default function EmployerHomeScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();

  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);

  const firstName = (user?.name || "").split(" ")[0] || "";

  // Fresh picks every time the tab regains focus (cheap: 3 workers).
  useFocusEffect(
    useCallback(() => {
      let active = true;

      listWorkers({})
        .then((data) => {
          if (active) setWorkers((data.workers || []).slice(0, 3));
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

        {/* ---------- Categories ---------- */}
        <Text style={styles.sectionTitle}>What do you need help with?</Text>
        <View style={styles.categoryGrid}>
          {SERVICE_OPTIONS.map((option) => (
            <Pressable
              key={option.value}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.categoryTile,
                pressed && styles.tilePressed,
              ]}
              onPress={() =>
                navigation.navigate("MaidsTab", { service: option.value })
              }
            >
              <View style={styles.categoryIcon}>
                <TabBarIcon name="users" color={colors.brand} size={18} />
              </View>
              <Text style={styles.categoryLabel}>{option.label}</Text>
            </Pressable>
          ))}
        </View>

        <LocationPromptCard />

        {/* ---------- Top picks ---------- */}
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Top rated near you</Text>
          <Pressable accessibilityRole="button" onPress={() => navigation.navigate("MaidsTab")}>
            <Text style={styles.seeAll}>See all</Text>
          </Pressable>
        </View>

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
          workers.map((worker) => (
            <WorkerMiniCard
              key={worker.id}
              worker={worker}
              onPress={() =>
                navigation.navigate("WorkerProfile", { workerId: worker.id })
              }
            />
          ))
        )}

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

function WorkerMiniCard({ worker, onPress }) {
  const firstName = (worker.name || "").split(" ")[0] || "?";
  const kycVerified = worker.kycStatus === "verified";

  return (
    <Pressable
      accessibilityRole="button"
      style={({ pressed }) => [styles.workerCard, pressed && styles.tilePressed]}
      onPress={onPress}
    >
      <View style={styles.workerAvatar}>
        <Text style={styles.workerAvatarText}>{firstName.charAt(0)}</Text>
      </View>

      <View style={styles.workerMain}>
        <View style={styles.workerNameRow}>
          <Text style={styles.workerName} numberOfLines={1}>
            {worker.name}
          </Text>
          {kycVerified ? (
            <View style={styles.verifiedBadge}>
              <Text style={styles.verifiedText}>ID verified</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.workerMeta} numberOfLines={1}>
          {[worker.locationLabel, worker.availability ? availabilityLabel(worker.availability) : null]
            .filter(Boolean)
            .join(" · ") || "Domestic worker"}
        </Text>
        <Text style={styles.workerServices} numberOfLines={1}>
          {(worker.services || []).map(serviceLabel).join(" · ") || "—"}
        </Text>
      </View>

      <View style={styles.workerRateBox}>
        {worker.hourlyRate !== null ? (
          <>
            <Text style={styles.workerRate}>KES {worker.hourlyRate}</Text>
            <Text style={styles.workerRateUnit}>/hr</Text>
          </>
        ) : (
          <Text style={styles.workerRateUnit}>Rate on ask</Text>
        )}
      </View>
    </Pressable>
  );
}

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
    marginBottom: 22,
  },
  searchText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "600",
    flex: 1,
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

  /* ---- Category grid ---- */
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  categoryTile: {
    width: "32%",
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.mist,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 10,
  },
  tilePressed: {
    backgroundColor: colors.cream,
  },
  categoryIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: withAlpha(colors.brand, 0.11),
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 7,
  },
  categoryLabel: {
    color: colors.ink,
    fontSize: 11.5,
    fontWeight: "700",
    textAlign: "center",
    paddingHorizontal: 4,
  },

  /* ---- Worker cards ---- */
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
  workerCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.mist,
    padding: 13,
    marginBottom: 10,
  },
  workerAvatar: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: withAlpha(colors.brand, 0.14),
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  workerAvatarText: {
    color: colors.brand,
    fontSize: 19,
    fontWeight: "800",
  },
  workerMain: {
    flex: 1,
    marginRight: 8,
  },
  workerNameRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  workerName: {
    flexShrink: 1,
    color: colors.ink,
    fontSize: 14.5,
    fontWeight: "800",
    marginRight: 6,
  },
  verifiedBadge: {
    backgroundColor: withAlpha(colors.brand, 0.14),
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  verifiedText: {
    color: colors.brand,
    fontSize: 9.5,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  workerMeta: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
  },
  workerServices: {
    color: colors.textFaint,
    fontSize: 11.5,
    fontWeight: "600",
    marginTop: 3,
  },
  workerRateBox: {
    alignItems: "flex-end",
  },
  workerRate: {
    color: colors.brand,
    fontSize: 13.5,
    fontWeight: "800",
  },
  workerRateUnit: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
  },

  /* ---- Trust ---- */
  trustCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: withAlpha(colors.gold, 0.13),
    borderRadius: 16,
    padding: 14,
    gap: 10,
    marginTop: 8,
  },
  trustText: {
    flex: 1,
    color: colors.goldDark,
    fontSize: 12,
    lineHeight: 17.5,
    fontWeight: "600",
  },
});
