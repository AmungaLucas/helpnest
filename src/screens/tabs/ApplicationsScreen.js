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
import EmptyState from "../../components/ui/EmptyState";
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
//
// v3: display-scale header, icon-led meta rows, EmptyState for empty/error,
// tokenized status pills. Logic untouched.
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
          <Text style={styles.eyebrow}>Job hunt</Text>
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
          android_ripple={{
            color: withAlpha(colors.brand, 0.08),
            borderless: false,
            radius: 16,
          }}
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
              actionLabel="Browse jobs"
              onAction={() => navigation.navigate("FindJobsTab")}
            />
          ) : (
            <EmptyState
              icon="file-text"
              title="No applications yet"
              body="Browse open roles and apply — employers see every applicant with a complete, visible profile."
              actionLabel="Browse jobs"
              onAction={() => navigation.navigate("FindJobsTab")}
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
                      android_ripple={{
                        color: withAlpha(colors.textMuted, 0.12),
                        borderless: false,
                        radius: 14,
                      }}
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
            <View style={styles.hintIcon}>
              <TabBarIcon name="info" color={colors.brand} size={14} />
            </View>
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
  findButton: {
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
  findButtonText: {
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
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.mistDark,
    paddingHorizontal: 12,
    paddingVertical: 7,
    minWidth: 84,
    alignItems: "center",
    overflow: "hidden",
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
  pressed: {
    opacity: 0.88,
  },
});
