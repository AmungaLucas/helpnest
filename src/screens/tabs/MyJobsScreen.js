import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
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

import { listMyJobs, setJobStatus } from "../../services/jobsService";
import EmptyState from "../../components/ui/EmptyState";
import TabBarIcon from "../../components/ui/TabBarIcon";
import { serviceLabel } from "../../utils/workerMeta";
import { colors, withAlpha } from "../../theme/colors";

// ---------------------------------------------------------------------------
// My Jobs (employer) — the caller's own posts. Each card shows its applicant
// count and publication window (30 days, PRD §11.7); tapping opens the
// applicant review. The server enforces the posting gate on submit; this
// screen only displays what exists and lets the employer close or reopen a
// listing (free within the window, PRD §11.2).
//
// v3: display-scale header, icon-led meta rows, data-driven status pills
// (open/expired/closed), gold Boost pill and a v3 grabber bottom sheet for
// the urgent/spotlight options. Logic untouched.
// ---------------------------------------------------------------------------
export default function MyJobsScreen() {
  const navigation = useNavigation();

  const [jobs, setJobs] = useState(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [boostJob, setBoostJob] = useState(null);

  const load = useCallback(async () => {
    setError("");

    try {
      const data = await listMyJobs();
      setJobs(data.jobs || []);
    } catch (err) {
      setError(err?.message || "Could not load your jobs.");
      setJobs([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      (async () => {
        try {
          const data = await listMyJobs();

          if (active) setJobs(data.jobs || []);
        } catch (err) {
          if (active) {
            setError(err?.message || "Could not load your jobs.");
            setJobs([]);
          }
        }
      })();

      return () => {
        active = false;
      };
    }, [])
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const toggleStatus = useCallback(
    async (job) => {
      const next = job.status === "open" ? "closed" : "open";

      setBusyId(job.id);

      try {
        await setJobStatus(job.id, next);
        setJobs((prev) =>
          prev.map((j) => (j.id === job.id ? { ...j, status: next } : j))
        );
      } catch (err) {
        Alert.alert(
          "Could not update",
          err?.message || "Try again in a moment."
        );
      } finally {
        setBusyId(null);
      }
    },
    []
  );

  const postedLabel = (iso) => {
    if (!iso) return "";

    const then = new Date(iso).getTime();

    if (Number.isNaN(then)) return "";

    const days = Math.floor((Date.now() - then) / 86400000);

    if (days <= 0) return "today";
    if (days === 1) return "yesterday";
    if (days < 30) return `${days}d ago`;

    return new Date(iso).toLocaleDateString();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.cream} />

      <View style={styles.header}>
        <View style={styles.headerBody}>
          <Text style={styles.eyebrow}>Your listings</Text>
          <Text style={styles.title}>My Jobs</Text>
          <Text style={styles.subtitle}>
            {jobs && jobs.length > 0
              ? `${jobs.length} listing${jobs.length === 1 ? "" : "s"} · manage or close them anytime`
              : "Everything you post lives here"}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.postButton,
            pressed && styles.pressed,
          ]}
          android_ripple={{
            color: withAlpha(colors.brand, 0.08),
            borderless: false,
            radius: 16,
          }}
          onPress={() => navigation.navigate("PostJob")}
        >
          <TabBarIcon name="file-text" color={colors.white} size={14} />
          <Text style={styles.postButtonText}>Post a job</Text>
        </Pressable>
      </View>

      {jobs === null ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.brand} />
        </View>
      ) : jobs.length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.center}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.brand}
            />
          }
        >
          {error ? (
            <EmptyState
              icon="alert-triangle"
              tone="danger"
              title="Something went wrong"
              body={error}
              actionLabel="Post your first job"
              onAction={() => navigation.navigate("PostJob")}
            />
          ) : (
            <EmptyState
              icon="work"
              title="No jobs yet"
              body="Post a job and verified maids nearby can respond — you review every applicant before reaching out."
              actionLabel="Post your first job"
              onAction={() => navigation.navigate("PostJob")}
            />
          )}
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.brand}
            />
          }
        >
          {error ? (
            <View style={styles.listErrorBanner}>
              <TabBarIcon
                name="alert-triangle"
                color={colors.danger}
                size={14}
              />
              <Text style={styles.listErrorText}>{error}</Text>
            </View>
          ) : null}

          {jobs.map((job) => {
            const open = job.status === "open";
            const expired =
              job.expiresAt && new Date(job.expiresAt).getTime() < Date.now();
            const daysLeft = expired
              ? 0
              : job.expiresAt
                ? Math.max(
                    1,
                    Math.ceil(
                      (new Date(job.expiresAt).getTime() - Date.now()) /
                        86400000
                    )
                  )
                : null;

            return (
              <Pressable
                key={job.id}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.jobCard,
                  pressed && styles.cardPressed,
                ]}
                android_ripple={{
                  color: withAlpha(colors.brand, 0.08),
                  borderless: false,
                  radius: 20,
                }}
                onPress={() =>
                  navigation.navigate("JobApplications", { job })
                }
              >
                <View style={styles.jobTop}>
                  <Text style={styles.jobTitle} numberOfLines={2}>
                    {job.title}
                  </Text>
                  <View
                    style={[
                      styles.statusPill,
                      open
                        ? expired
                          ? styles.statusExpired
                          : styles.statusOpen
                        : styles.statusClosed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        open
                          ? expired
                            ? styles.statusExpiredText
                            : styles.statusOpenText
                          : styles.statusClosedText,
                      ]}
                    >
                      {open ? (expired ? "Expired" : "Open") : "Closed"}
                    </Text>
                  </View>
                </View>

                <View style={styles.jobMeta}>
                  <View style={styles.categoryChip}>
                    <Text style={styles.categoryText}>
                      {serviceLabel(job.category)}
                    </Text>
                  </View>
                  {job.locationLabel ? (
                    <View style={styles.metaItem}>
                      <TabBarIcon
                        name="map-pin"
                        color={colors.textFaint}
                        size={12}
                      />
                      <Text style={styles.metaText} numberOfLines={1}>
                        {job.locationLabel}
                      </Text>
                    </View>
                  ) : null}
                  {job.rateKes ? (
                    <View style={styles.metaItem}>
                      <TabBarIcon
                        name="credit-card"
                        color={colors.textFaint}
                        size={12}
                      />
                      <Text style={styles.metaText}>KES {job.rateKes}</Text>
                    </View>
                  ) : null}
                </View>

                {job.description ? (
                  <Text style={styles.jobDesc} numberOfLines={2}>
                    {job.description}
                  </Text>
                ) : null}

                <View style={styles.jobFooter}>
                  <View style={styles.footerInfo}>
                    <Text style={styles.dateText}>
                      Posted {postedLabel(job.createdAt)}
                      {open && !expired && daysLeft
                        ? ` · ${daysLeft}d left`
                        : ""}
                    </Text>
                    <View style={styles.appsBadge}>
                      <TabBarIcon name="users" color={colors.brand} size={12} />
                      <Text style={styles.appsBadgeText}>
                        {job.applicationsCount || 0} applicant
                        {(job.applicationsCount || 0) === 1 ? "" : "s"}
                      </Text>
                    </View>
                  </View>
                  {open && !expired ? (
                    <Pressable
                      accessibilityRole="button"
                      style={({ pressed }) => [
                        styles.boostBtn,
                        pressed && styles.pressed,
                      ]}
                      android_ripple={{
                        color: withAlpha(colors.gold, 0.12),
                        borderless: false,
                        radius: 14,
                      }}
                      onPress={() => setBoostJob(job)}
                    >
                      <TabBarIcon
                        name="zap"
                        color={colors.goldDark}
                        size={12}
                      />
                      <Text style={styles.boostBtnText}>Boost</Text>
                    </Pressable>
                  ) : null}
                  <Pressable
                    accessibilityRole="button"
                    disabled={busyId === job.id}
                    style={({ pressed }) => [
                      styles.statusToggle,
                      pressed && styles.pressed,
                      busyId === job.id && styles.toggleBusy,
                    ]}
                    android_ripple={{
                      color: withAlpha(colors.brand, 0.08),
                      borderless: false,
                      radius: 14,
                    }}
                    onPress={() => toggleStatus(job)}
                  >
                    {busyId === job.id ? (
                      <ActivityIndicator size="small" color={colors.brand} />
                    ) : (
                      <Text style={styles.statusToggleText}>
                        {open ? "Close listing" : "Reopen"}
                      </Text>
                    )}
                  </Pressable>
                </View>
              </Pressable>
            );
          })}

          <View style={styles.hintCard}>
            <View style={styles.hintIcon}>
              <TabBarIcon name="shield" color={colors.brand} size={14} />
            </View>
            <Text style={styles.hintText}>
              Keep chats and payments in the app — every contact unlock and
              job post is paid through M-Pesa.
            </Text>
          </View>
        </ScrollView>
      )}

      {/* Boost options (PRD §5.2/§18.3) — Urgent +100 and Spotlight 200
          stack; the purchase rides the standard M-Pesa checkout with the
          job id as metadata so the gateway targets the right listing. */}
      <Modal
        visible={Boolean(boostJob)}
        transparent
        animationType="slide"
        onRequestClose={() => setBoostJob(null)}
      >
        <View style={styles.boostSheetWrap}>
          <Pressable
            style={styles.boostSheetBackdrop}
            onPress={() => setBoostJob(null)}
          />
          <View style={styles.boostSheet}>
            <View style={styles.grabber} />

            <Text style={styles.boostSheetTitle}>Boost this job</Text>
            <Text style={styles.boostSheetSub} numberOfLines={1}>
              {boostJob?.title}
            </Text>

            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.boostOption,
                pressed && styles.pressed,
              ]}
              android_ripple={{
                color: withAlpha(colors.brand, 0.08),
                borderless: false,
                radius: 16,
              }}
              onPress={() => {
                const job = boostJob;
                setBoostJob(null);
                navigation.navigate("MpesaCheckout", {
                  plan: "urgent_boost",
                  jobId: job.id,
                  label: "Urgent boost — 24h",
                });
              }}
            >
              <View style={styles.boostOptionIcon}>
                <TabBarIcon name="zap" color={colors.goldDark} size={16} />
              </View>
              <View style={styles.boostOptionMain}>
                <Text style={styles.boostOptionTitle}>Urgent boost</Text>
                <Text style={styles.boostOptionText}>
                  Labeled urgent placement at the top of the feed for 24
                  hours.
                </Text>
              </View>
              <Text style={styles.boostOptionPrice}>+KES 100</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.boostOption,
                pressed && styles.pressed,
              ]}
              android_ripple={{
                color: withAlpha(colors.brand, 0.08),
                borderless: false,
                radius: 16,
              }}
              onPress={() => {
                const job = boostJob;
                setBoostJob(null);
                navigation.navigate("MpesaCheckout", {
                  plan: "spotlight",
                  jobId: job.id,
                  label: "Spotlight — 24h",
                });
              }}
            >
              <View style={styles.boostOptionIcon}>
                <TabBarIcon name="star" color={colors.goldDark} size={16} />
              </View>
              <View style={styles.boostOptionMain}>
                <Text style={styles.boostOptionTitle}>Spotlight</Text>
                <Text style={styles.boostOptionText}>
                  Pinned spotlight placement for 24 hours — stacks with
                  urgent.
                </Text>
              </View>
              <Text style={styles.boostOptionPrice}>KES 200</Text>
            </Pressable>

            <Text style={styles.boostNote}>
              Placement is labeled “Promoted”, never guaranteed a position
              (PRD §18.3). Not delivered? You get a refund or credit.
            </Text>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 14,
    gap: 12,
  },
  headerBody: {
    flex: 1,
  },
  eyebrow: {
    color: colors.goldDark,
    fontSize: 10.5,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 3,
  },
  title: {
    color: colors.ink,
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.6,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 12.5,
    lineHeight: 17,
    fontWeight: "600",
    marginTop: 3,
  },
  postButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.brand,
    borderRadius: 14,
    paddingHorizontal: 13,
    minHeight: 40,
    shadowColor: colors.ink,
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
    overflow: "hidden",
  },
  postButtonText: {
    color: colors.white,
    fontSize: 12.5,
    fontWeight: "800",
  },
  center: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  listErrorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    backgroundColor: withAlpha(colors.danger, 0.1),
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
  },
  listErrorText: {
    flex: 1,
    color: colors.danger,
    fontSize: 12.5,
    lineHeight: 18,
    fontWeight: "600",
  },
  list: {
    padding: 20,
    paddingTop: 4,
    paddingBottom: 40,
  },
  jobCard: {
    backgroundColor: colors.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.mist,
    padding: 16,
    marginBottom: 12,
    shadowColor: colors.ink,
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 1,
  },
  cardPressed: {
    opacity: 0.88,
  },
  jobTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  jobTitle: {
    flex: 1,
    color: colors.ink,
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 21,
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusOpen: {
    backgroundColor: withAlpha(colors.brand, 0.12),
  },
  statusExpired: {
    backgroundColor: withAlpha(colors.gold, 0.16),
  },
  statusClosed: {
    backgroundColor: withAlpha(colors.textMuted, 0.14),
  },
  statusText: {
    fontSize: 11,
    fontWeight: "800",
  },
  statusOpenText: {
    color: colors.brand,
  },
  statusExpiredText: {
    color: colors.goldDark,
  },
  statusClosedText: {
    color: colors.textMuted,
  },
  jobMeta: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 10,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flexShrink: 1,
  },
  categoryChip: {
    backgroundColor: withAlpha(colors.brand, 0.1),
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  categoryText: {
    color: colors.brand,
    fontSize: 11.5,
    fontWeight: "800",
  },
  metaText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "600",
    flexShrink: 1,
  },
  jobDesc: {
    color: colors.textMuted,
    fontSize: 12.5,
    lineHeight: 19,
    marginTop: 10,
  },
  jobFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.mist,
    gap: 8,
  },
  footerInfo: {
    flex: 1,
    gap: 4,
  },
  appsBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    backgroundColor: withAlpha(colors.brand, 0.08),
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  appsBadgeText: {
    color: colors.brand,
    fontSize: 11,
    fontWeight: "800",
  },
  dateText: {
    color: colors.textMuted,
    fontSize: 11.5,
    fontWeight: "600",
  },
  boostBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: withAlpha(colors.gold, 0.4),
    borderRadius: 12,
    paddingHorizontal: 11,
    paddingVertical: 7,
    backgroundColor: withAlpha(colors.gold, 0.12),
    overflow: "hidden",
  },
  boostBtnText: {
    color: colors.goldDark,
    fontSize: 12,
    fontWeight: "800",
  },
  statusToggle: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.brand,
    paddingHorizontal: 12,
    paddingVertical: 7,
    minWidth: 96,
    alignItems: "center",
    overflow: "hidden",
  },
  toggleBusy: {
    opacity: 0.6,
  },
  statusToggleText: {
    color: colors.brand,
    fontSize: 12,
    fontWeight: "800",
  },
  hintCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.mist,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 6,
    shadowColor: colors.ink,
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  hintIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: withAlpha(colors.brand, 0.1),
    alignItems: "center",
    justifyContent: "center",
  },
  hintText: {
    flex: 1,
    color: colors.textMuted,
    fontSize: 11.5,
    lineHeight: 17,
    fontWeight: "600",
  },
  grabber: {
    alignSelf: "center",
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.cloud,
    marginBottom: 14,
  },
  boostSheetWrap: {
    flex: 1,
    justifyContent: "flex-end",
  },
  boostSheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: withAlpha(colors.ink, 0.45),
  },
  boostSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    padding: 20,
    paddingBottom: 30,
    gap: 10,
  },
  boostSheetTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  boostSheetSub: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "600",
  },
  boostOption: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.mistDark,
    borderRadius: 16,
    padding: 14,
    backgroundColor: colors.cream,
    gap: 12,
    overflow: "hidden",
  },
  boostOptionIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: withAlpha(colors.gold, 0.16),
    alignItems: "center",
    justifyContent: "center",
  },
  boostOptionMain: {
    flex: 1,
  },
  boostOptionTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "800",
  },
  boostOptionText: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  boostOptionPrice: {
    color: colors.brand,
    fontSize: 14,
    fontWeight: "800",
  },
  boostNote: {
    color: colors.textFaint,
    fontSize: 11,
    lineHeight: 15,
    textAlign: "center",
  },
  pressed: {
    opacity: 0.88,
  },
});
