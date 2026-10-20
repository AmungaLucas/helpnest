import React, { useCallback, useRef, useState } from "react";
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

import {
  applyToJob,
  getJob,
  listJobFeed,
} from "../../services/jobsService";
import { getEntitlements } from "../../services/entitlementsService";
import ApplyAccessModal from "../../components/ui/ApplyAccessModal";
import TabBarIcon from "../../components/ui/TabBarIcon";
import { SERVICE_OPTIONS, serviceLabel } from "../../utils/workerMeta";
import { colors, withAlpha } from "../../theme/colors";

// ---------------------------------------------------------------------------
// Find Jobs (maid) — the live job feed (PRD §6 / §13.2).
//
// Applying consumes one application entitlement server-side. When the maid
// is out of credits and plans the server answers 402: we hold the intended
// application in pendingJobRef, open ApplyAccessModal, and after payment
// the focus refetch retries the SAME application automatically — the
// paywall never makes the maid re-find the job (PRD §20.4 recovery).
// ---------------------------------------------------------------------------
export default function FindJobsScreen() {
  const navigation = useNavigation();

  const [jobs, setJobs] = useState(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [category, setCategory] = useState(null);
  const [applyCredits, setApplyCredits] = useState(null);

  // Detail sheet
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [appliedIds, setAppliedIds] = useState({});
  const [gateOpen, setGateOpen] = useState(false);

  const pendingJobRef = useRef(null);
  const aliveRef = useRef(true);
  const categoryRef = useRef(null);

  const load = useCallback(async () => {
    setError("");

    try {
      const [feed, ent] = await Promise.all([
        listJobFeed(categoryRef.current ? { category: categoryRef.current } : {}),
        getEntitlements().catch(() => null),
      ]);

      if (!aliveRef.current) return;

      setJobs(feed.jobs || []);

      if (ent) setApplyCredits(ent.credits?.apply ?? null);
    } catch (err) {
      if (!aliveRef.current) return;

      setError(err?.message || "Could not load jobs right now.");
      setJobs([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      aliveRef.current = true;
      load();

      return () => {
        aliveRef.current = false;
      };
    }, [load])
  );

  // Auto-continue a held application after payment (or re-open the paywall
  // if the purchase hasn't landed yet).
  useFocusEffect(
    useCallback(() => {
      const pending = pendingJobRef.current;

      if (!pending) return undefined;

      pendingJobRef.current = null;

      (async () => {
        try {
          await applyToJob(pending.id);
          setAppliedIds((prev) => ({ ...prev, [pending.id]: true }));
          setDetail(null);
          Alert.alert(
            "Application sent 🎉",
            "The employer can now see your application under their job."
          );
        } catch (err) {
          if (err?.status === 402) {
            pendingJobRef.current = pending;
            setGateOpen(true);
          } else if (err?.status === 409) {
            setAppliedIds((prev) => ({ ...prev, [pending.id]: true }));
            setDetail(null);
            Alert.alert(
              "Already applied",
              "You applied to this job earlier — track it under Applications."
            );
          } else {
            Alert.alert(
              "Could not apply",
              err?.message || "Try again in a moment."
            );
          }
        }
      })();

      return undefined;
    }, [])
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const pickCategory = useCallback(
    (value) => {
      const next = categoryRef.current === value ? null : value;

      categoryRef.current = next;
      setCategory(next);
      setJobs(null);
      load();
    },
    [load]
  );

  const openDetail = useCallback(async (job) => {
    setDetail(job);
    setDetailLoading(true);

    try {
      const data = await getJob(job.id);

      if (data.job) setDetail(data.job);
    } catch (err) {
      // Keep showing the feed row if the detail fetch fails.
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const handleApply = useCallback(async () => {
    const job = detail;

    if (!job || applying) return;

    setApplying(true);

    try {
      await applyToJob(job.id);
      setAppliedIds((prev) => ({ ...prev, [job.id]: true }));
      setDetail(null);
      Alert.alert(
        "Application sent 🎉",
        "The employer can now see your application under their job."
      );
    } catch (err) {
      if (err?.status === 402) {
        pendingJobRef.current = job;
        setGateOpen(true);
      } else if (err?.status === 409) {
        setAppliedIds((prev) => ({ ...prev, [job.id]: true }));
        setDetail(null);
        Alert.alert(
          "Already applied",
          "You applied to this job earlier — track it under Applications."
        );
      } else {
        Alert.alert(
          "Could not apply",
          err?.message || "Try again in a moment."
        );
      }
    } finally {
      setApplying(false);
    }
  }, [detail, applying]);

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
          <Text style={styles.title}>Find Jobs</Text>
          <Text style={styles.subtitle}>
            {applyCredits === null
              ? "Open roles from households near you"
              : applyCredits > 0
                ? `${applyCredits} application${applyCredits === 1 ? "" : "s"} ready · new roles daily`
                : "Browse freely — applying needs a credit or plan"}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [styles.appsButton, pressed && styles.pressed]}
          onPress={() => navigation.navigate("ApplicationsTab")}
        >
          <TabBarIcon name="file-text" color={colors.brand} size={14} />
          <Text style={styles.appsButtonText}>My apps</Text>
        </Pressable>
      </View>

      <View style={styles.chipRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRowContent}
        >
          {SERVICE_OPTIONS.map((option) => {
            const on = category === option.value;

            return (
              <Pressable
                key={option.value}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                style={({ pressed }) => [
                  styles.chip,
                  on && styles.chipOn,
                  pressed && styles.pressed,
                ]}
                onPress={() => pickCategory(option.value)}
              >
                <Text style={[styles.chipText, on && styles.chipTextOn]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {jobs === null ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.brand} />
        </View>
      ) : jobs.length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.center}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        >
          {error ? (
            <>
              <Text style={styles.errorTitle}>Couldn't load jobs</Text>
              <Text style={styles.errorText}>{error}</Text>
              <Pressable
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.retryButton,
                  pressed && styles.pressed,
                ]}
                onPress={load}
              >
                <Text style={styles.retryText}>Try again</Text>
              </Pressable>
            </>
          ) : (
            <>
              <View style={styles.emptyBadge}>
                <TabBarIcon name="search" color={colors.brand} size={26} />
              </View>
              <Text style={styles.emptyTitle}>No open roles yet</Text>
              <Text style={styles.emptyText}>
                {category
                  ? "Nothing in this service right now — try another category."
                  : "Employers post new jobs every day. Make sure your profile is complete and visible so they can find you too."}
              </Text>
            </>
          )}
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        >
          {error ? <Text style={styles.listError}>{error}</Text> : null}

          {jobs.map((job) => {
            const applied = Boolean(appliedIds[job.id]);

            return (
              <Pressable
                key={job.id}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.jobCard,
                  pressed && styles.cardPressed,
                ]}
                onPress={() => openDetail(job)}
              >
                <View style={styles.jobTop}>
                  <View style={styles.jobTitleWrap}>
                    <Text style={styles.jobTitle} numberOfLines={2}>
                      {job.title}
                    </Text>
                    <View style={styles.employerRow}>
                      <Text style={styles.employerName} numberOfLines={1}>
                        {job.employerName}
                      </Text>
                      {job.employerVerified ? (
                        <TabBarIcon
                          name="shield-check"
                          color={colors.brand}
                          size={13}
                        />
                      ) : null}
                    </View>
                  </View>

                  {applied ? (
                    <View style={[styles.appliedPill]}>
                      <Text style={styles.appliedText}>Applied</Text>
                    </View>
                  ) : (
                    <View style={styles.ratePill}>
                      <Text style={styles.rateText}>
                        {job.rateKes ? `KES ${job.rateKes}` : serviceLabel(job.category)}
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.metaRow}>
                  <View style={styles.categoryChip}>
                    <Text style={styles.categoryText}>
                      {serviceLabel(job.category)}
                    </Text>
                  </View>
                  {job.locationLabel ? (
                    <Text style={styles.metaText} numberOfLines={1}>
                      · {job.locationLabel}
                    </Text>
                  ) : null}
                </View>

                <View style={styles.footRow}>
                  <Text style={styles.dateText}>
                    Posted {postedLabel(job.createdAt)}
                  </Text>
                  <Text style={styles.viewText}>View & apply →</Text>
                </View>
              </Pressable>
            );
          })}

          <View style={styles.hintCard}>
            <TabBarIcon name="info" color={colors.brand} size={14} />
            <Text style={styles.hintText}>
              Your first application is on us. After that, a single
              application is KES 50 — or go weekly for bundles.
            </Text>
          </View>
        </ScrollView>
      )}

      {/* ---- Job detail + apply sheet ---- */}
      <Modal
        visible={detail !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setDetail(null)}
      >
        <Pressable style={styles.flex} onPress={() => setDetail(null)} />
        <View style={styles.detailSheet}>
          <View style={styles.grabber} />

          {detail ? (
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.detailTitle}>{detail.title}</Text>

              <View style={styles.employerRow}>
                <Text style={styles.employerName}>{detail.employerName}</Text>
                {detail.employerVerified ? (
                  <View style={styles.verifiedPill}>
                    <Text style={styles.verifiedText}>Verified</Text>
                  </View>
                ) : null}
              </View>

              <View style={styles.metaRow}>
                <View style={styles.categoryChip}>
                  <Text style={styles.categoryText}>
                    {serviceLabel(detail.category)}
                  </Text>
                </View>
                {detail.rateKes ? (
                  <Text style={styles.rateLine}>KES {detail.rateKes}</Text>
                ) : null}
                {detail.locationLabel ? (
                  <Text style={styles.metaText}>{detail.locationLabel}</Text>
                ) : null}
              </View>

              {detailLoading && !detail.description ? (
                <ActivityIndicator
                  style={styles.detailSpinner}
                  color={colors.brand}
                />
              ) : null}

              {detail.description ? (
                <Text style={styles.detailDesc}>{detail.description}</Text>
              ) : null}

              <Text style={styles.detailMeta}>
                Posted {postedLabel(detail.createdAt)}
                {detail.expiresAt
                  ? ` · open until ${new Date(detail.expiresAt).toLocaleDateString()}`
                  : ""}
              </Text>

              {appliedIds[detail.id] ? (
                <View style={styles.appliedBanner}>
                  <TabBarIcon
                    name="check-circle"
                    color={colors.brand}
                    size={16}
                  />
                  <Text style={styles.appliedBannerText}>
                    You applied to this job — track it under Applications.
                  </Text>
                </View>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  disabled={applying}
                  style={({ pressed }) => [
                    styles.applyButton,
                    pressed && styles.pressed,
                    applying && styles.buttonBusy,
                  ]}
                  onPress={handleApply}
                >
                  {applying ? (
                    <ActivityIndicator color={colors.white} />
                  ) : (
                    <Text style={styles.applyButtonText}>
                      {applyCredits > 0
                        ? "Apply now"
                        : "Apply now · from KES 50"}
                    </Text>
                  )}
                </Pressable>
              )}

              <Text style={styles.detailFootnote}>
                Applying uses one application credit. Your first one is free;
                extras are KES 50 each or included in weekly plans.
              </Text>
            </ScrollView>
          ) : null}
        </View>
      </Modal>

      {/* ---- Paywall (402) ---- */}
      <ApplyAccessModal
        visible={gateOpen}
        onClose={() => setGateOpen(false)}
        jobTitle={pendingJobRef.current?.title || detail?.title}
      />
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
    paddingHorizontal: 22,
    paddingTop: 14,
    paddingBottom: 10,
    gap: 12,
  },
  headerBody: {
    flex: 1,
  },
  title: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: "800",
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
  },
  appsButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: colors.brand,
    borderRadius: 12,
    paddingHorizontal: 12,
    minHeight: 38,
  },
  appsButtonText: {
    color: colors.brand,
    fontSize: 12.5,
    fontWeight: "800",
  },
  chipRow: {
    paddingBottom: 4,
  },
  chipRowContent: {
    paddingHorizontal: 22,
    gap: 8,
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.mistDark,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  chipOn: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  chipText: {
    color: colors.textMuted,
    fontSize: 12.5,
    fontWeight: "700",
  },
  chipTextOn: {
    color: colors.white,
  },
  center: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  emptyBadge: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: withAlpha(colors.brand, 0.12),
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
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
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
  },
  errorTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 6,
    textAlign: "center",
  },
  errorText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
    marginBottom: 14,
  },
  retryButton: {
    borderRadius: 12,
    backgroundColor: colors.brand,
    paddingHorizontal: 18,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  retryText: {
    color: colors.white,
    fontSize: 13.5,
    fontWeight: "800",
  },
  listError: {
    color: "#B3403A",
    fontSize: 12.5,
    marginBottom: 10,
  },
  list: {
    padding: 22,
    paddingTop: 10,
    paddingBottom: 40,
  },
  jobCard: {
    backgroundColor: colors.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.mist,
    padding: 16,
    marginBottom: 12,
  },
  cardPressed: {
    opacity: 0.92,
  },
  jobTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  jobTitleWrap: {
    flex: 1,
  },
  jobTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "800",
    lineHeight: 20,
  },
  employerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 3,
  },
  employerName: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
  },
  appliedPill: {
    borderRadius: 999,
    backgroundColor: withAlpha(colors.brand, 0.12),
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  appliedText: {
    color: colors.brand,
    fontSize: 11,
    fontWeight: "800",
  },
  ratePill: {
    borderRadius: 999,
    backgroundColor: withAlpha(colors.gold, 0.16),
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  rateText: {
    color: colors.goldDark,
    fontSize: 11,
    fontWeight: "800",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
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
  footRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.mist,
  },
  dateText: {
    color: colors.textMuted,
    fontSize: 11.5,
    fontWeight: "600",
  },
  viewText: {
    color: colors.brand,
    fontSize: 11.5,
    fontWeight: "800",
  },
  hintCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: withAlpha(colors.brand, 0.08),
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 6,
  },
  hintText: {
    flex: 1,
    color: colors.textMuted,
    fontSize: 11.5,
    lineHeight: 17,
    fontWeight: "600",
  },
  flex: {
    flex: 1,
    backgroundColor: "rgba(38, 49, 43, 0.45)",
  },
  detailSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 22,
    paddingTop: 10,
    paddingBottom: 28,
    maxHeight: "82%",
  },
  grabber: {
    alignSelf: "center",
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.cloud,
    marginBottom: 14,
  },
  detailTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "800",
    lineHeight: 24,
  },
  verifiedPill: {
    backgroundColor: withAlpha(colors.brand, 0.12),
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  verifiedText: {
    color: colors.brand,
    fontSize: 10,
    fontWeight: "800",
  },
  rateLine: {
    color: colors.goldDark,
    fontSize: 12.5,
    fontWeight: "800",
  },
  detailDesc: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 14,
  },
  detailSpinner: {
    marginTop: 14,
  },
  detailMeta: {
    color: colors.textFaint,
    fontSize: 11.5,
    fontWeight: "600",
    marginTop: 14,
  },
  applyButton: {
    minHeight: 52,
    borderRadius: 15,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 18,
  },
  buttonBusy: {
    opacity: 0.7,
  },
  applyButtonText: {
    color: colors.white,
    fontSize: 14.5,
    fontWeight: "800",
  },
  appliedBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: withAlpha(colors.brand, 0.08),
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 18,
  },
  appliedBannerText: {
    flex: 1,
    color: colors.brand,
    fontSize: 12.5,
    fontWeight: "700",
    lineHeight: 18,
  },
  detailFootnote: {
    color: colors.textFaint,
    fontSize: 11,
    lineHeight: 16,
    textAlign: "center",
    marginTop: 10,
  },
  pressed: {
    opacity: 0.9,
  },
});
