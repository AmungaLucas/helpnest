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

import {
  listMyApplications,
  setApplicationStatus,
} from "../../services/jobsService";
import TabBarIcon from "../../components/ui/TabBarIcon";
import { serviceLabel } from "../../utils/workerMeta";
import { colors, withAlpha } from "../../theme/colors";

// Status -> pill palette (PRD §12.1 states we surface at launch).
const STATUS_STYLES = {
  submitted: { bg: withAlpha(colors.gold, 0.16), fg: colors.goldDark, label: "Submitted" },
  viewed: { bg: withAlpha(colors.brand, 0.1), fg: colors.brand, label: "Viewed" },
  shortlisted: { bg: withAlpha(colors.brand, 0.16), fg: colors.brand, label: "Shortlisted" },
  accepted: { bg: withAlpha(colors.brandSoft, 0.24), fg: colors.brand, label: "Accepted" },
  rejected: { bg: withAlpha(colors.danger, 0.12), fg: colors.danger, label: "Not selected" },
  withdrawn: { bg: withAlpha(colors.textMuted, 0.14), fg: colors.textMuted, label: "Withdrawn" },
};

// ---------------------------------------------------------------------------
// Applications (maid) — every application with its live status (PRD §12).
// Withdrawal is free but does NOT restore the application credit (§12.2).
// ---------------------------------------------------------------------------
export default function ApplicationsScreen() {
  const navigation = useNavigation();

  const [applications, setApplications] = useState(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setError("");

    try {
      const data = await listMyApplications();
      setApplications(data.applications || []);
    } catch (err) {
      setError(err?.message || "Could not load your applications.");
      setApplications([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      (async () => {
        try {
          const data = await listMyApplications();

          if (active) setApplications(data.applications || []);
        } catch (err) {
          if (active) {
            setError(err?.message || "Could not load your applications.");
            setApplications([]);
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

  const confirmWithdraw = useCallback((application) => {
    Alert.alert(
      "Withdraw this application?",
      "The employer will no longer see it as active. The application credit is not returned.",
      [
        { text: "Keep it", style: "cancel" },
        {
          text: "Withdraw",
          style: "destructive",
          onPress: () => withdraw(application),
        },
      ]
    );
  }, []);

  const withdraw = useCallback(
    async (application) => {
      setBusyId(application.id);

      try {
        await setApplicationStatus(application.id, "withdrawn");
        setApplications((prev) =>
          prev.map((a) =>
            a.id === application.id ? { ...a, status: "withdrawn" } : a
          )
        );
      } catch (err) {
        Alert.alert(
          "Could not withdraw",
          err?.message || "Try again in a moment."
        );
      } finally {
        setBusyId(null);
      }
    },
    []
  );

  const appliedLabel = (iso) => {
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
          <Text style={styles.title}>My Applications</Text>
          <Text style={styles.subtitle}>
            {applications && applications.length > 0
              ? `${applications.length} application${applications.length === 1 ? "" : "s"} · statuses update live`
              : "Every job you apply for lives here"}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [styles.findButton, pressed && styles.pressed]}
          onPress={() => navigation.navigate("FindJobsTab")}
        >
          <TabBarIcon name="search" color={colors.white} size={14} />
          <Text style={styles.findButtonText}>Find jobs</Text>
        </Pressable>
      </View>

      {applications === null ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.brand} />
        </View>
      ) : applications.length === 0 ? (
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
                <TabBarIcon name="file-text" color={colors.brand} size={26} />
              </View>
              <Text style={styles.emptyTitle}>No applications yet</Text>
              <Text style={styles.emptyText}>
                Browse open roles and apply — employers see every applicant
                with a complete, visible profile.
              </Text>
            </>
          )}
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [styles.emptyCta, pressed && styles.pressed]}
            onPress={() => navigation.navigate("FindJobsTab")}
          >
            <TabBarIcon name="search" color={colors.white} size={15} />
            <Text style={styles.emptyCtaText}>Browse jobs</Text>
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

          {applications.map((application) => {
            const pill = STATUS_STYLES[application.status] || STATUS_STYLES.submitted;
            const job = application.job || {};

            return (
              <View key={application.id} style={styles.card}>
                <View style={styles.cardTop}>
                  <Text style={styles.jobTitle} numberOfLines={2}>
                    {job.title || "Job"}
                  </Text>
                  <View style={[styles.statusPill, { backgroundColor: pill.bg }]}>
                    <Text style={[styles.statusText, { color: pill.fg }]}>
                      {pill.label}
                    </Text>
                  </View>
                </View>

                <View style={styles.employerRow}>
                  <Text style={styles.employerName} numberOfLines={1}>
                    {job.employerName || "Employer"}
                  </Text>
                  {job.employerVerified ? (
                    <TabBarIcon name="shield-check" color={colors.brand} size={13} />
                  ) : null}
                </View>

                <View style={styles.metaRow}>
                  {job.category ? (
                    <View style={styles.categoryChip}>
                      <Text style={styles.categoryText}>
                        {serviceLabel(job.category)}
                      </Text>
                    </View>
                  ) : null}
                  {job.locationLabel ? (
                    <Text style={styles.metaText} numberOfLines={1}>
                      · {job.locationLabel}
                    </Text>
                  ) : null}
                  {job.rateKes ? (
                    <Text style={styles.metaText}>· KES {job.rateKes}</Text>
                  ) : null}
                </View>

                <View style={styles.cardFooter}>
                  <Text style={styles.dateText}>
                    Applied {appliedLabel(application.createdAt)}
                  </Text>

                  {application.status !== "withdrawn" &&
                  application.status !== "accepted" &&
                  application.status !== "rejected" ? (
                    <Pressable
                      accessibilityRole="button"
                      disabled={busyId === application.id}
                      style={({ pressed }) => [
                        styles.withdrawButton,
                        pressed && styles.pressed,
                        busyId === application.id && styles.busy,
                      ]}
                      onPress={() => confirmWithdraw(application)}
                    >
                      {busyId === application.id ? (
                        <ActivityIndicator size="small" color={colors.textMuted} />
                      ) : (
                        <Text style={styles.withdrawText}>Withdraw</Text>
                      )}
                    </Pressable>
                  ) : null}
                </View>
              </View>
            );
          })}

          <View style={styles.hintCard}>
            <TabBarIcon name="info" color={colors.brand} size={14} />
            <Text style={styles.hintText}>
              Employers are notified when you apply. Shortlisted means they
              want to talk — keep your phone nearby.
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
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 12,
    gap: 12,
  },
  headerBody: {
    flex: 1,
  },
  title: {
    color: colors.ink,
    fontSize: 23,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
  },
  findButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.brand,
    borderRadius: 12,
    paddingHorizontal: 12,
    minHeight: 38,
  },
  findButtonText: {
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
    fontSize: 18,
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
    fontSize: 17,
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
    color: colors.danger,
    fontSize: 12.5,
    marginBottom: 10,
  },
  list: {
    padding: 20,
    paddingTop: 4,
    paddingBottom: 40,
  },
  card: {
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
  cardTop: {
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
  statusText: {
    fontSize: 11,
    fontWeight: "800",
  },
  employerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  employerName: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
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
  cardFooter: {
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
  withdrawButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.mistDark,
    paddingHorizontal: 12,
    paddingVertical: 7,
    minWidth: 84,
    alignItems: "center",
  },
  busy: {
    opacity: 0.6,
  },
  withdrawText: {
    color: colors.textMuted,
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
    opacity: 0.88,
  },
});
