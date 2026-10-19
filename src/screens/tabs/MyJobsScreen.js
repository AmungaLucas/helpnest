import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import TabBarIcon from "../../components/ui/TabBarIcon";
import { serviceLabel } from "../../utils/workerMeta";
import { colors, withAlpha } from "../../theme/colors";

// ---------------------------------------------------------------------------
// My Jobs (employer) — the caller's own posts with the paid posting flow one
// tap away. The server enforces the KES 500 fee / plan coverage on submit;
// this screen only displays what exists and lets the employer close or
// reopen a listing.
// ---------------------------------------------------------------------------
export default function MyJobsScreen() {
  const navigation = useNavigation();

  const [jobs, setJobs] = useState(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState(null);

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
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        >
          {error ? (
            <>
              <Text style={styles.errorTitle}>Something went wrong</Text>
              <Text style={styles.errorText}>{error}</Text>
            </>
          ) : (
            <>
              <View style={styles.emptyBadge}>
                <TabBarIcon name="work" color={colors.brand} size={26} />
              </View>
              <Text style={styles.emptyTitle}>No jobs yet</Text>
              <Text style={styles.emptyText}>
                Post a job and verified maids nearby can respond — you review
                every applicant before reaching out.
              </Text>
            </>
          )}
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.emptyCta,
              pressed && styles.pressed,
            ]}
            onPress={() => navigation.navigate("PostJob")}
          >
            <TabBarIcon name="file-text" color={colors.white} size={15} />
            <Text style={styles.emptyCtaText}>Post your first job</Text>
          </Pressable>
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
            const open = job.status === "open";

            return (
              <View key={job.id} style={styles.jobCard}>
                <View style={styles.jobTop}>
                  <Text style={styles.jobTitle} numberOfLines={2}>
                    {job.title}
                  </Text>
                  <View
                    style={[
                      styles.statusPill,
                      open ? styles.statusOpen : styles.statusClosed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        open ? styles.statusOpenText : styles.statusClosedText,
                      ]}
                    >
                      {open ? "Open" : "Closed"}
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
                    <Text style={styles.metaText} numberOfLines={1}>
                      {job.locationLabel}
                    </Text>
                  ) : null}
                  {job.rateKes ? (
                    <Text style={styles.metaText}>· KES {job.rateKes}</Text>
                  ) : null}
                </View>

                {job.description ? (
                  <Text style={styles.jobDesc} numberOfLines={2}>
                    {job.description}
                  </Text>
                ) : null}

                <View style={styles.jobFooter}>
                  <Text style={styles.dateText}>
                    Posted {postedLabel(job.createdAt)}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    disabled={busyId === job.id}
                    style={({ pressed }) => [
                      styles.statusToggle,
                      pressed && styles.pressed,
                      busyId === job.id && styles.toggleBusy,
                    ]}
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
              </View>
            );
          })}

          <View style={styles.hintCard}>
            <TabBarIcon name="shield" color={colors.brand} size={14} />
            <Text style={styles.hintText}>
              Keep chats and payments in the app — every contact unlock and
              job post is paid through M-Pesa.
            </Text>
          </View>
        </ScrollView>
      )}
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
    paddingBottom: 12,
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
  postButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.brand,
    borderRadius: 12,
    paddingHorizontal: 12,
    minHeight: 38,
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
    marginBottom: 18,
  },
  emptyCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.brand,
    borderRadius: 14,
    minHeight: 48,
    paddingHorizontal: 20,
  },
  emptyCtaText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: "800",
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
    marginBottom: 18,
  },
  listError: {
    color: "#B3403A",
    fontSize: 12.5,
    marginBottom: 10,
  },
  list: {
    padding: 22,
    paddingTop: 4,
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
  jobTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  jobTitle: {
    flex: 1,
    color: colors.ink,
    fontSize: 15,
    fontWeight: "800",
    lineHeight: 20,
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusOpen: {
    backgroundColor: withAlpha(colors.brand, 0.12),
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
  statusClosedText: {
    color: colors.textMuted,
  },
  jobMeta: {
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
  },
  dateText: {
    color: colors.textMuted,
    fontSize: 11.5,
    fontWeight: "600",
  },
  statusToggle: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.brand,
    paddingHorizontal: 12,
    paddingVertical: 7,
    minWidth: 96,
    alignItems: "center",
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
  pressed: {
    opacity: 0.9,
  },
});
