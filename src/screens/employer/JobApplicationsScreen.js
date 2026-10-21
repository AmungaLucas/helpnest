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
import EmptyState from "../../components/ui/EmptyState";
import ScreenHeader from "../../components/ui/ScreenHeader";
import TabBarIcon from "../../components/ui/TabBarIcon";
import { availabilityLabel } from "../../utils/workerMeta";
import { colors, withAlpha } from "../../theme/colors";

// Status -> pill palette (PRD §12.1). submitted rows are shown as viewed
// server-side the moment this list opens.
const STATUS_STYLES = {
  submitted: {
    bg: withAlpha(colors.gold, 0.16),
    fg: colors.goldDark,
    label: "Submitted",
    icon: "clock",
  },
  viewed: {
    bg: withAlpha(colors.brand, 0.1),
    fg: colors.brand,
    label: "Viewed",
    icon: "eye",
  },
  shortlisted: {
    bg: withAlpha(colors.brand, 0.16),
    fg: colors.brand,
    label: "Shortlisted",
    icon: "star",
  },
  accepted: {
    bg: withAlpha(colors.brandSoft, 0.24),
    fg: colors.brand,
    label: "Hired",
    icon: "check",
  },
  rejected: {
    bg: withAlpha(colors.danger, 0.12),
    fg: colors.danger,
    label: "Declined",
    icon: "x",
  },
  withdrawn: {
    bg: withAlpha(colors.textMuted, 0.14),
    fg: colors.textMuted,
    label: "Withdrawn",
    icon: "log-out",
  },
};

// ---------------------------------------------------------------------------
// Job Applications (employer) — review who applied to one listing (PRD §12).
// Opening the list marks fresh submissions as viewed; shortlist / hire /
// decline are one tap each and never consume an entitlement (§12.1).
//
// Modern v3: cream canvas with a faint orb, ScreenHeader back bar, tighter
// applicant cards with icon-led status pills, squircle avatars, and a
// paired Hire (brand filled) vs Decline (danger outline) action row. Logic
// untouched.
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

      {/* Ambient orb — echoes the rest of the app. */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={styles.orb} />
      </View>

      <ScreenHeader
        title="Applicants"
        subtitle={job?.title || "Job"}
        eyebrow="Hiring"
        leading="back"
        onBack={() => navigation.goBack()}
      />

      {applications === null ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.brand} />
          <Text style={styles.loadingText}>Loading applicants…</Text>
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
            />
          ) : (
            <EmptyState
              icon="users"
              title="No applicants yet"
              body="Maids see this listing in Find Jobs while it's open. Complete listings with a fair rate get more responses."
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
              <View style={styles.listErrorIcon}>
                <TabBarIcon
                  name="alert-triangle"
                  color={colors.danger}
                  size={13}
                />
              </View>
              <Text style={styles.listErrorText}>{error}</Text>
            </View>
          ) : null}

          {applications.map((application) => {
            const pill =
              STATUS_STYLES[application.status] || STATUS_STYLES.submitted;
            const maid = application.maid || {};
            const decided = ["accepted", "rejected", "withdrawn"].includes(
              application.status
            );

            return (
              <View key={application.id} style={styles.card}>
                <View style={styles.personRow}>
                  <View style={styles.avatarWrap}>
                    <SignedImage
                      mediaId={maid.profileMediaId}
                      variant="thumb"
                      fallbackText={(maid.name || "?").slice(0, 1)}
                      style={styles.avatar}
                      textStyle={styles.avatarText}
                    />
                    {maid.kycVerified ? (
                      <View style={styles.verifiedDot}>
                        <TabBarIcon name="check" color={colors.white} size={8} />
                      </View>
                    ) : null}
                  </View>

                  <View style={styles.personBody}>
                    <Text style={styles.personName} numberOfLines={1}>
                      {maid.name}
                    </Text>
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
                      <View style={styles.rateChip}>
                        <Text style={styles.rateChipText}>
                          KES {maid.hourlyRate}/hr
                          {maid.availability
                            ? ` · ${availabilityLabel(maid.availability)}`
                            : ""}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>

                <View
                  style={[styles.statusPill, { backgroundColor: pill.bg }]}
                >
                  <TabBarIcon name={pill.icon} color={pill.fg} size={10} />
                  <Text style={[styles.statusText, { color: pill.fg }]}>
                    {pill.label}
                  </Text>
                </View>

                {maid.bio ? (
                  <Text style={styles.bio} numberOfLines={3}>
                    {maid.bio}
                  </Text>
                ) : null}

                <View style={styles.cardFooter}>
                  <View style={styles.dateChip}>
                    <TabBarIcon
                      name="clock"
                      color={colors.textFaint}
                      size={10}
                    />
                    <Text style={styles.dateText}>
                      Applied {appliedLabel(application.createdAt)}
                    </Text>
                  </View>

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
                        android_ripple={{
                          color: withAlpha(colors.danger, 0.08),
                          borderless: false,
                          radius: 14,
                        }}
                        onPress={() => decide(application, "rejected")}
                      >
                        <TabBarIcon
                          name="x"
                          color={colors.danger}
                          size={12}
                        />
                        <Text style={styles.declineText}>Decline</Text>
                      </Pressable>

                      <Pressable
                        accessibilityRole="button"
                        style={({ pressed }) => [
                          styles.actionButton,
                          styles.hireButton,
                          pressed && styles.pressed,
                        ]}
                        android_ripple={{
                          color: withAlpha(colors.brand, 0.08),
                          borderless: false,
                          radius: 14,
                        }}
                        onPress={() => confirmHire(application)}
                      >
                        <TabBarIcon
                          name="check"
                          color={colors.white}
                          size={12}
                        />
                        <Text style={styles.hireText}>Hire</Text>
                      </Pressable>
                    </View>
                  )}
                </View>

                {application.status === "shortlisted" ? (
                  <View style={styles.shortlistBanner}>
                    <View style={styles.shortlistIcon}>
                      <TabBarIcon
                        name="star"
                        color={colors.goldDark}
                        size={11}
                      />
                    </View>
                    <Text style={styles.shortlistText}>
                      Shortlisted — chat with{" "}
                      {application.maid.name.split(" ")[0]} to arrange next
                      steps.
                    </Text>
                  </View>
                ) : null}
              </View>
            );
          })}

          <View style={styles.hintCard}>
            <View style={styles.hintIcon}>
              <TabBarIcon name="shield" color={colors.brand} size={13} />
            </View>
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
  center: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 30,
  },
  loadingText: {
    color: colors.textMuted,
    marginTop: 14,
    fontSize: 13.5,
    fontWeight: "600",
  },
  orb: {
    position: "absolute",
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: withAlpha(colors.brand, 0.04),
    top: -140,
    right: -100,
  },

  /* ---- List ---- */
  list: {
    padding: 16,
    paddingTop: 8,
    paddingBottom: 40,
  },
  listErrorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: withAlpha(colors.danger, 0.08),
    borderRadius: 14,
    borderWidth: 1,
    borderColor: withAlpha(colors.danger, 0.2),
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  listErrorIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: withAlpha(colors.danger, 0.14),
    alignItems: "center",
    justifyContent: "center",
  },
  listErrorText: {
    flex: 1,
    color: colors.danger,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
  },

  /* ---- Card ---- */
  card: {
    backgroundColor: colors.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: withAlpha(colors.ink, 0.05),
    padding: 14,
    marginBottom: 12,
    shadowColor: colors.ink,
    shadowOpacity: 0.07,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },

  /* ---- Person header ---- */
  personRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  avatarWrap: {
    position: "relative",
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: withAlpha(colors.brand, 0.12),
  },
  avatarText: {
    fontSize: 20,
    color: colors.brand,
    fontWeight: "800",
  },
  verifiedDot: {
    position: "absolute",
    right: -3,
    bottom: -3,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.white,
  },
  personBody: {
    flex: 1,
    paddingTop: 1,
  },
  personName: {
    color: colors.ink,
    fontSize: 15.5,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  personMeta: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "600",
    marginTop: 3,
  },
  rateChip: {
    alignSelf: "flex-start",
    backgroundColor: withAlpha(colors.gold, 0.14),
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
    marginTop: 6,
  },
  rateChipText: {
    color: colors.goldDark,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.1,
  },

  /* ---- Status pill (top-right, absolute overlay) ---- */
  statusPill: {
    position: "absolute",
    top: 14,
    right: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.2,
  },

  /* ---- Bio ---- */
  bio: {
    color: colors.textMuted,
    fontSize: 12.5,
    lineHeight: 19,
    marginTop: 12,
    fontWeight: "500",
  },

  /* ---- Footer ---- */
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: withAlpha(colors.ink, 0.06),
    gap: 10,
  },
  dateChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  dateText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "600",
  },

  /* ---- Actions ---- */
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 8,
    minHeight: 36,
    justifyContent: "center",
    overflow: "hidden",
  },
  declineButton: {
    borderWidth: 1,
    borderColor: withAlpha(colors.danger, 0.3),
    backgroundColor: colors.white,
  },
  declineText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: "800",
  },
  hireButton: {
    backgroundColor: colors.brand,
    shadowColor: colors.brand,
    shadowOpacity: 0.22,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  hireText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: "800",
  },

  /* ---- Shortlist banner ---- */
  shortlistBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: withAlpha(colors.gold, 0.1),
    borderRadius: 14,
    borderWidth: 1,
    borderColor: withAlpha(colors.gold, 0.28),
    paddingHorizontal: 11,
    paddingVertical: 9,
    marginTop: 10,
  },
  shortlistIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: withAlpha(colors.gold, 0.2),
    alignItems: "center",
    justifyContent: "center",
  },
  shortlistText: {
    flex: 1,
    color: colors.goldDark,
    fontSize: 11.5,
    fontWeight: "700",
    lineHeight: 16,
  },

  /* ---- Hint card ---- */
  hintCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: withAlpha(colors.brand, 0.06),
    borderRadius: 16,
    borderWidth: 1,
    borderColor: withAlpha(colors.brand, 0.14),
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 6,
  },
  hintIcon: {
    width: 32,
    height: 32,
    borderRadius: 11,
    backgroundColor: withAlpha(colors.brand, 0.12),
    alignItems: "center",
    justifyContent: "center",
  },
  hintText: {
    flex: 1,
    color: colors.brand,
    fontSize: 11.5,
    lineHeight: 17,
    fontWeight: "600",
  },

  pressed: {
    opacity: 0.88,
  },
});