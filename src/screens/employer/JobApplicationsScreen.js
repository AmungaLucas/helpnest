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
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";

import {
  listJobApplications,
  setApplicationStatus,
} from "../../services/jobsService";
import SignedImage from "../../components/media/SignedImage";
import TabBarIcon from "../../components/ui/TabBarIcon";
import { availabilityLabel } from "../../utils/workerMeta";
import { colors, withAlpha } from "../../theme/colors";

// Status -> pill palette (PRD §12.1). submitted rows are shown as viewed
// server-side the moment this list opens.
const STATUS_STYLES = {
  submitted: { bg: withAlpha(colors.gold, 0.16), fg: colors.goldDark, label: "Submitted" },
  viewed: { bg: withAlpha(colors.brand, 0.1), fg: colors.brand, label: "Viewed" },
  shortlisted: { bg: withAlpha(colors.brand, 0.16), fg: colors.brand, label: "Shortlisted" },
  accepted: { bg: withAlpha(colors.brandSoft, 0.24), fg: colors.brand, label: "Hired" },
  rejected: { bg: withAlpha(colors.danger, 0.12), fg: colors.danger, label: "Declined" },
  withdrawn: { bg: withAlpha(colors.textMuted, 0.14), fg: colors.textMuted, label: "Withdrawn" },
};

// ---------------------------------------------------------------------------
// Job Applications (employer) — review who applied to one listing (PRD §12).
// Opening the list marks fresh submissions as viewed; shortlist / hire /
// decline are one tap each and never consume an entitlement (§12.1).
// ---------------------------------------------------------------------------
export default function JobApplicationsScreen() {
  const navigation = useNavigation();
  const { params } = useRoute();
  const job = params?.job || null;

  const [applications, setApplications] = useState(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const jobId = job?.id;

  const load = useCallback(async () => {
    if (!jobId) return;

    setError("");

    try {
      const data = await listJobApplications(jobId);
      setApplications(data.applications || []);
    } catch (err) {
      setError(err?.message || "Could not load applicants.");
      setApplications([]);
    }
  }, [jobId]);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      (async () => {
        if (!jobId) return;

        try {
          const data = await listJobApplications(jobId);

          if (active) setApplications(data.applications || []);
        } catch (err) {
          if (active) {
            setError(err?.message || "Could not load applicants.");
            setApplications([]);
          }
        }
      })();

      return () => {
        active = false;
      };
    }, [jobId])
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const decide = useCallback(
    async (application, status) => {
      setBusyId(application.id);

      try {
        await setApplicationStatus(application.id, status);
        setApplications((prev) =>
          prev.map((a) =>
            a.id === application.id ? { ...a, status } : a
          )
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

  const confirmHire = useCallback(
    (application) => {
      Alert.alert(
        `Hire ${application.maid.name.split(" ")[0]}?`,
        "They'll be notified straight away. You can keep chatting to arrange the details.",
        [
          { text: "Not yet", style: "cancel" },
          { text: "Hire", onPress: () => decide(application, "accepted") },
        ]
      );
    },
    [decide]
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
        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          onPress={() => navigation.goBack()}
        >
          <TabBarIcon name="chevron-left" color={colors.ink} size={20} />
        </Pressable>

        <View style={styles.headerBody}>
          <Text style={styles.title}>Applicants</Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {job?.title || "Job"}
          </Text>
        </View>
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
                <TabBarIcon name="users" color={colors.brand} size={26} />
              </View>
              <Text style={styles.emptyTitle}>No applicants yet</Text>
              <Text style={styles.emptyText}>
                Maids see this listing in Find Jobs while it's open. Complete
                listings with a fair rate get more responses.
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

          {applications.map((application) => {
            const pill = STATUS_STYLES[application.status] || STATUS_STYLES.submitted;
            const maid = application.maid || {};
            const decided = ["accepted", "rejected", "withdrawn"].includes(
              application.status
            );

            return (
              <View key={application.id} style={styles.card}>
                <View style={styles.personRow}>
                  <SignedImage
                    mediaId={maid.profileMediaId}
                    variant="thumb"
                    fallbackText={(maid.name || "?").slice(0, 1)}
                    style={styles.avatar}
                    textStyle={styles.avatarText}
                  />

                  <View style={styles.personBody}>
                    <View style={styles.nameRow}>
                      <Text style={styles.personName} numberOfLines={1}>
                        {maid.name}
                      </Text>
                      {maid.kycVerified ? (
                        <TabBarIcon
                          name="shield-check"
                          color={colors.brand}
                          size={14}
                        />
                      ) : null}
                    </View>

                    <Text style={styles.personMeta} numberOfLines={1}>
                      {[
                        maid.title,
                        maid.locationLabel,
                        maid.experienceYears != null
                          ? `${maid.experienceYears} yrs experience`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "Household worker"}
                    </Text>

                    {maid.hourlyRate ? (
                      <Text style={styles.personRate}>
                        KES {maid.hourlyRate}/hr
                        {maid.availability
                          ? ` · ${availabilityLabel(maid.availability)}`
                          : ""}
                      </Text>
                    ) : null}
                  </View>

                  <View style={[styles.statusPill, { backgroundColor: pill.bg }]}>
                    <Text style={[styles.statusText, { color: pill.fg }]}>
                      {pill.label}
                    </Text>
                  </View>
                </View>

                {maid.bio ? (
                  <Text style={styles.bio} numberOfLines={3}>
                    {maid.bio}
                  </Text>
                ) : null}

                <View style={styles.cardFooter}>
                  <Text style={styles.dateText}>
                    Applied {appliedLabel(application.createdAt)}
                  </Text>

                  {decided ? null : busyId === application.id ? (
                    <ActivityIndicator size="small" color={colors.brand} />
                  ) : (
                    <View style={styles.actionsRow}>
                      <Pressable
                        accessibilityRole="button"
                        style={({ pressed }) => [
                          styles.actionButton,
                          styles.declineButton,
                          pressed && styles.pressed,
                        ]}
                        onPress={() => decide(application, "rejected")}
                      >
                        <Text style={styles.declineText}>Decline</Text>
                      </Pressable>

                      <Pressable
                        accessibilityRole="button"
                        style={({ pressed }) => [
                          styles.actionButton,
                          styles.hireButton,
                          pressed && styles.pressed,
                        ]}
                        onPress={() => confirmHire(application)}
                      >
                        <Text style={styles.hireText}>Hire</Text>
                      </Pressable>
                    </View>
                  )}
                </View>

                {application.status === "shortlisted" ? (
                  <View style={styles.shortlistBanner}>
                    <TabBarIcon name="star" color={colors.goldDark} size={12} />
                    <Text style={styles.shortlistText}>
                      Shortlisted — chat with {application.maid.name.split(" ")[0]} to
                      arrange next steps.
                    </Text>
                  </View>
                ) : null}
              </View>
            );
          })}

          <View style={styles.hintCard}>
            <TabBarIcon name="shield" color={colors.brand} size={14} />
            <Text style={styles.hintText}>
              Keep hiring in the app — chat first, then hire here so the
              history stays protected for both of you.
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
    paddingTop: 10,
    paddingBottom: 12,
    gap: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.mist,
    alignItems: "center",
    justifyContent: "center",
  },
  headerBody: {
    flex: 1,
  },
  title: {
    color: colors.ink,
    fontSize: 21,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
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
  personRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: withAlpha(colors.brand, 0.12),
  },
  avatarText: {
    fontSize: 20,
    color: colors.brand,
    fontWeight: "800",
  },
  personBody: {
    flex: 1,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  personName: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "800",
    flexShrink: 1,
  },
  personMeta: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
  },
  personRate: {
    color: colors.goldDark,
    fontSize: 11.5,
    fontWeight: "800",
    marginTop: 2,
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
  bio: {
    color: colors.textMuted,
    fontSize: 12.5,
    lineHeight: 19,
    marginTop: 12,
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.mist,
    gap: 10,
  },
  dateText: {
    color: colors.textMuted,
    fontSize: 11.5,
    fontWeight: "600",
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  actionButton: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minHeight: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  declineButton: {
    borderWidth: 1,
    borderColor: colors.mistDark,
  },
  declineText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "800",
  },
  hireButton: {
    backgroundColor: colors.brand,
  },
  hireText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: "800",
  },
  shortlistBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: withAlpha(colors.gold, 0.12),
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginTop: 10,
  },
  shortlistText: {
    flex: 1,
    color: colors.goldDark,
    fontSize: 11.5,
    fontWeight: "700",
    lineHeight: 16,
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
