import React, { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";

import { useAuth } from "../../context/AuthContext";
import { getWorker } from "../../services/workersService";
import { fileReport, REPORT_CATEGORIES } from "../../services/reportsService";
import Chip from "../../components/ui/Chip";
import TabBarIcon from "../../components/ui/TabBarIcon";
import ScreenHeader from "../../components/ui/ScreenHeader";
import EmptyState from "../../components/ui/EmptyState";
import GradientBanner from "../../components/ui/GradientBanner";
import SignedImage from "../../components/media/SignedImage";
import { colors, withAlpha } from "../../theme/colors";
import {
  availabilityLabel,
  serviceLabel,
} from "../../utils/workerMeta";
import { formatDistance } from "../../utils/geo";

// ---------------------------------------------------------------------------
// Worker profile — large photo header (136px ringed portrait on a tinted
// backdrop), verified chip, white stat cards, tinted status pills and the
// monetized "Chat with {name}" CTA pinned as a sticky bottom bar.
//
// Chat gate (BUILD 2026-10-20.14): tapping Chat jumps straight into ChatRoom,
// which owns the §13.3 flow end-to-end — it creates/opens the conversation,
// consumes the entitlement (welcome credit / pass / subscription) and shows
// the paywall sheet itself when no entitlement applies.
// ---------------------------------------------------------------------------
export default function WorkerProfileScreen() {
  const navigation = useNavigation();
  const { params } = useRoute();
  const workerId = params?.workerId;
  const { user } = useAuth();

  const isEmployer = user?.role === "employer";

  const [worker, setWorker] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Report sheet (PRD §10.2) — flag this profile for human moderation.
  const [reportOpen, setReportOpen] = useState(false);
  const [reportCategory, setReportCategory] = useState(null);
  const [reportNote, setReportNote] = useState("");
  const [reportBusy, setReportBusy] = useState(false);

  // Refetch whenever the screen regains focus — after an M-Pesa unlock or
  // chat purchase succeeds and the user comes back, contacts + chat
  // entitlement reflect it.
  useFocusEffect(
    useCallback(() => {
      let active = true;

      (async () => {
        setError("");

        try {
          const data = await getWorker(workerId);

          if (!active) return;
          setWorker(data.worker);

        } catch (err) {
          if (active) setError(err?.message || "Could not load this profile.");
        } finally {
          if (active) setLoading(false);
        }
      })();

      return () => {
        active = false;
      };
    }, [workerId, navigation])
  );

  const openChat = useCallback(() => {
    // ChatRoom owns the whole §13.3 flow: it ensures/creates the
    // conversation, consumes the entitlement and shows the paywall when
    // none applies (BUILD 2026-10-20.14).
    navigation.navigate("ChatRoom", {
      workerId: worker.id,
      name: worker.name,
      role: "maid",
    });
  }, [navigation, worker]);

  const handleChatPress = useCallback(() => {
    openChat();
  }, [openChat]);

  const submitReport = useCallback(async () => {
    if (reportBusy || !reportCategory || reportNote.trim().length < 10) return;
    setReportBusy(true);
    try {
      const res = await fileReport({
        targetUserId: worker.id,
        category: reportCategory,
        note: reportNote.trim(),
      });
      setReportOpen(false);
      setReportCategory(null);
      setReportNote("");
      Alert.alert(
        "Report received",
        res?.message ||
          "A human reviews every report, and we'll notify you once it's handled.",
        [{ text: "OK" }]
      );
    } catch (err) {
      Alert.alert(
        "Could not send report",
        err?.message || "Please try again in a moment."
      );
    } finally {
      setReportBusy(false);
    }
  }, [reportBusy, reportCategory, reportNote, worker]);

  if (loading) {
    return (
      <SafeAreaView style={[styles.safeArea, styles.center]}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.cream} />
        <ActivityIndicator size="large" color={colors.brand} />
      </SafeAreaView>
    );
  }

  if (error || !worker) {
    return (
      <SafeAreaView style={[styles.safeArea, styles.center]}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.cream} />
        <EmptyState
          icon="alert-triangle"
          tone="danger"
          title="Profile unavailable"
          body={error || "Worker not found."}
          actionLabel="Go back"
          onAction={() => navigation.goBack()}
        />
      </SafeAreaView>
    );
  }

  const firstName = (worker.name || "").split(" ")[0] || "?";
  const kycVerified = worker.kycStatus === "verified";

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.cream} />

      <ScreenHeader
        title="Worker profile"
        leading="back"
        right={
          user && worker.id !== user.id ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Report this profile"
              onPress={() => setReportOpen(true)}
              hitSlop={8}
              style={({ pressed }) => [
                styles.reportFlagBtn,
                pressed && styles.pressed,
              ]}
              android_ripple={{
                color: withAlpha(colors.danger, 0.08),
                borderless: false,
                radius: 20,
              }}
            >
              <TabBarIcon name="flag" color={colors.danger} size={16} />
            </Pressable>
          ) : null
        }
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ---- Photo header ---- */}
        <View style={[styles.heroCard, styles.cardShadow]}>
          <GradientBanner style={styles.heroBand} />

          {/* Ring lives on a wrapper View — a borderWidth directly on the
              <Image> renders unevenly on Android (clipped/shaved by the
              rounded-corner overflow clip), so the photo itself stays
              borderless and the wrapper owns the 4px ring. */}
          <View style={styles.avatarRing}>
            <SignedImage
              url={worker?.avatarDisplayUrl || worker?.avatarUrl}
              mediaId={worker?.avatarMediaId}
              variant="display"
              fallbackText={firstName}
              style={styles.avatar}
              textStyle={styles.avatarText}
            />
          </View>

          <Text style={styles.name}>{worker.name}</Text>
          <Text style={styles.headline}>
            {worker.title || "Domestic worker"}
          </Text>

          <View style={styles.badgeRow}>
            {kycVerified ? (
              <View style={styles.verifiedBadge}>
                <TabBarIcon
                  name="shield-check"
                  color={colors.brand}
                  size={12}
                />
                <Text style={styles.verifiedText}>ID verified</Text>
              </View>
            ) : (
              <View style={styles.pendingBadge}>
                <TabBarIcon name="clock" color={colors.goldDark} size={12} />
                <Text style={styles.pendingText}>
                  Verification in progress
                </Text>
              </View>
            )}
            {worker.locationLabel || worker.distanceKm != null ? (
              <Text style={styles.areaText} numberOfLines={1}>
                {worker.locationLabel || ""}
                {worker.locationLabel && formatDistance(worker.distanceKm)
                  ? " · "
                  : ""}
                {formatDistance(worker.distanceKm)
                  ? `${formatDistance(worker.distanceKm)} away`
                  : ""}
              </Text>
            ) : null}
          </View>
        </View>

        {/* ---- Stats ---- */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>
              {worker.hourlyRate !== null ? `KES ${worker.hourlyRate}` : "—"}
            </Text>
            <Text style={styles.statLabel}>per hour</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>
              {worker.experienceYears !== null
                ? `${worker.experienceYears} yr${worker.experienceYears === 1 ? "" : "s"}`
                : "—"}
            </Text>
            <Text style={styles.statLabel}>experience</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>
              {worker.availability ? availabilityLabel(worker.availability) : "—"}
            </Text>
            <Text style={styles.statLabel}>availability</Text>
          </View>
        </View>

        {worker.bio ? (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>About</Text>
            <Text style={styles.bioText}>{worker.bio}</Text>
          </View>
        ) : null}

        {worker.services.length > 0 ? (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Services</Text>
            <View style={styles.chipsWrap}>
              {worker.services.map((value) => (
                <Chip key={value} label={serviceLabel(value)} selected disabled />
              ))}
            </View>
          </View>
        ) : null}

        {/* ---- Contact (gated) ---- */}
        <View
          style={[
            styles.contactCard,
            !worker.contactUnlocked && styles.contactCardLocked,
          ]}
        >
          {worker.contactUnlocked && worker.phone ? (
            <>
              <View
                style={[
                  styles.contactBadge,
                  { backgroundColor: withAlpha(colors.brand, 0.12) },
                ]}
              >
                <TabBarIcon
                  name="shield-check"
                  color={colors.brand}
                  size={17}
                />
              </View>
              <Text style={styles.contactTitle}>Contact unlocked</Text>
              <Text style={styles.contactPhone}>
                {formatKenyanPhone(worker.phone)}
              </Text>
              <Text style={styles.contactNote}>
                Reach out directly and mention HelpNest. For everyone's
                safety, keep payments and agreements inside the app once
                messaging launches.
              </Text>

              <View style={styles.contactActions}>
                <Pressable
                  accessibilityRole="button"
                  android_ripple={{ color: withAlpha(colors.brand, 0.08) }}
                  style={({ pressed }) => [
                    styles.contactButton,
                    styles.contactButtonPrimary,
                    pressed && styles.pressed,
                  ]}
                  onPress={() =>
                    Linking.openURL(`tel:${normalizeDialNumber(worker.phone)}`)
                  }
                >
                  <TabBarIcon name="phone" color={colors.white} size={15} />
                  <Text style={styles.contactButtonPrimaryText}>Call</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  android_ripple={{ color: withAlpha(colors.brand, 0.08) }}
                  style={({ pressed }) => [
                    styles.contactButton,
                    pressed && styles.pressed,
                  ]}
                  onPress={() =>
                    Linking.openURL(
                      `sms:${normalizeDialNumber(worker.phone)}`
                    )
                  }
                >
                  <TabBarIcon name="message-circle" color={colors.brand} size={15} />
                  <Text style={styles.contactButtonText}>SMS</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <>
              <View
                style={[
                  styles.contactBadge,
                  { backgroundColor: withAlpha(colors.gold, 0.16) },
                ]}
              >
                <TabBarIcon name="lock" color={colors.goldDark} size={17} />
              </View>
              <Text style={styles.contactTitle}>Contact is private</Text>
              <Text style={styles.contactNote}>
                Unlock {worker.name.split(" ")[0]}'s phone number to arrange
                work directly.
              </Text>
              <Pressable
                accessibilityRole="button"
                android_ripple={{ color: withAlpha(colors.brand, 0.08) }}
                style={({ pressed }) => [
                  styles.unlockButton,
                  pressed && styles.pressed,
                ]}
                onPress={() =>
                  navigation.navigate("MpesaCheckout", {
                    plan: "contact_unlock",
                    label: `Unlock ${firstName}'s contact`,
                    workerId: worker.id,
                  })
                }
              >
                <Text style={styles.unlockText}>
                  Unlock contact · KES 300
                </Text>
              </Pressable>
            </>
          )}
        </View>

        {/* ---- Report (PRD §10.2) ---- */}
        {user && worker.id !== user.id ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Report this profile"
            style={({ pressed }) => [styles.reportRow, pressed && styles.pressed]}
            onPress={() => setReportOpen(true)}
          >
            <TabBarIcon name="flag" color={colors.danger} size={14} />
            <Text style={styles.reportRowText}>Report this profile</Text>
          </Pressable>
        ) : null}
      </ScrollView>

      {/* ---- Sticky gated chat CTA (employers only) ---- */}
      {isEmployer ? (
        <View style={styles.ctaBar}>
          <Pressable
            accessibilityRole="button"
            android_ripple={{ color: withAlpha(colors.brand, 0.08) }}
            style={({ pressed }) => [
              styles.chatButton,
              pressed && styles.pressed,
            ]}
            onPress={handleChatPress}
          >
            <TabBarIcon name="message-circle" color={colors.white} size={17} />
            <Text style={styles.chatButtonText} numberOfLines={1}>
              Chat with {firstName}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {/* ---- Report sheet (PRD §10.2) ---- */}
      <Modal
        transparent
        visible={reportOpen}
        animationType="slide"
        onRequestClose={() => setReportOpen(false)}
      >
        <View style={styles.sheetBackdrop}>
          <Pressable style={styles.sheetBackdropTouch} onPress={() => setReportOpen(false)} />
          <View style={styles.sheet}>
            <View style={styles.sheetGrabber} />
            <Text style={styles.sheetTitle}>Report {firstName}'s profile</Text>
            <Text style={styles.sheetSub}>
              Tell us what's wrong. Reports go to a human moderation queue and
              stay anonymous.
            </Text>

            <View style={styles.reportChips}>
              {REPORT_CATEGORIES.map((c) => (
                <Chip
                  key={c.value}
                  label={c.label}
                  selected={reportCategory === c.value}
                  onPress={() => setReportCategory(c.value)}
                />
              ))}
            </View>

            <TextInput
              style={styles.reportInput}
              value={reportNote}
              onChangeText={(t) => setReportNote(t.slice(0, 1000))}
              multiline
              placeholder="Describe what happened (at least 10 characters)…"
              placeholderTextColor={colors.textFaint}
            />

            <View style={styles.sheetButtons}>
              <Pressable
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.sheetCancel,
                  pressed && styles.pressed,
                ]}
                onPress={() => setReportOpen(false)}
              >
                <Text style={styles.sheetCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                android_ripple={{ color: withAlpha(colors.white, 0.18) }}
                disabled={reportBusy || !reportCategory || reportNote.trim().length < 10}
                style={({ pressed }) => [
                  styles.sheetSubmit,
                  (reportBusy || !reportCategory || reportNote.trim().length < 10) &&
                    styles.sheetSubmitDisabled,
                  pressed && styles.pressed,
                ]}
                onPress={submitReport}
              >
                {reportBusy ? (
                  <ActivityIndicator color={colors.white} size="small" />
                ) : (
                  <Text style={styles.sheetSubmitText}>Send report</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function formatKenyanPhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");

  if (/^254\d{9}$/.test(digits)) {
    return `+254 ${digits.slice(3, 6)} ${digits.slice(6, 9)} ${digits.slice(9)}`;
  }

  return phone;
}

// Digits-only, Kenyan-prefixed number for tel:/sms: links.
function normalizeDialNumber(phone) {
  const digits = String(phone || "").replace(/\D/g, "");

  if (/^0\d{9}$/.test(digits)) {
    return `+254${digits.slice(1)}`;
  }

  if (/^\d{9}$/.test(digits)) {
    return `+254${digits}`;
  }

  return `+${digits}`;
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  pressed: {
    opacity: 0.88,
  },

  /* ---- Header ---- */
  reportFlagBtn: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: withAlpha(colors.danger, 0.08),
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },

  /* ---- Scroll ---- */
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 32,
  },
  cardShadow: {
    shadowColor: colors.ink,
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 1,
  },

  /* ---- Photo header ---- */
  heroCard: {
    backgroundColor: colors.white,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.mist,
    paddingHorizontal: 22,
    paddingBottom: 24,
    alignItems: "center",
    overflow: "hidden",
  },
  heroBand: {
    alignSelf: "stretch",
    height: 118,
  },
  // 144 = 136 photo + 4px ring on each side; ring outer radius 72, inner
  // edge radius 68 matches the photo radius exactly — concentric circles,
  // constant ring width on every device.
  avatarRing: {
    width: 144,
    height: 144,
    borderRadius: 72,
    borderWidth: 4,
    borderColor: colors.white,
    backgroundColor: colors.mist,
    marginTop: -72,
    marginBottom: 8,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatar: {
    width: 136,
    height: 136,
    borderRadius: 68,
    backgroundColor: colors.mist,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarText: {
    color: colors.brand,
    fontSize: 52,
    fontWeight: "800",
  },
  name: {
    color: colors.ink,
    fontSize: 23,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  headline: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "500",
    marginTop: 3,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
  },
  verifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: withAlpha(colors.brand, 0.12),
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginRight: 8,
  },
  verifiedText: {
    color: colors.brand,
    fontSize: 11,
    fontWeight: "800",
  },
  pendingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: withAlpha(colors.gold, 0.16),
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginRight: 8,
  },
  pendingText: {
    color: colors.goldDark,
    fontSize: 11,
    fontWeight: "800",
  },
  areaText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "600",
    flexShrink: 1,
  },

  /* ---- Stats ---- */
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },
  statBox: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.mist,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: "center",
    shadowColor: colors.ink,
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  statValue: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "800",
    textAlign: "center",
  },
  statLabel: {
    color: colors.textFaint,
    fontSize: 11.5,
    fontWeight: "600",
    marginTop: 4,
    textAlign: "center",
  },

  /* ---- Sections ---- */
  sectionCard: {
    backgroundColor: colors.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.mist,
    padding: 18,
    marginTop: 16,
    shadowColor: colors.ink,
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  sectionTitle: {
    color: colors.goldDark,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  bioText: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
  },
  chipsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
  },

  /* ---- Contact (gated) ---- */
  contactCard: {
    backgroundColor: colors.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.mist,
    padding: 18,
    marginTop: 16,
    alignItems: "center",
    shadowColor: colors.ink,
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  contactCardLocked: {
    borderStyle: "dashed",
    borderColor: colors.mistDark,
  },
  contactBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  contactTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: "800",
    marginBottom: 6,
  },
  contactPhone: {
    color: colors.brand,
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  contactNote: {
    color: colors.textMuted,
    fontSize: 12.5,
    lineHeight: 19,
    textAlign: "center",
  },
  unlockButton: {
    backgroundColor: colors.brand,
    borderRadius: 16,
    minHeight: 54,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 22,
    marginTop: 16,
    alignSelf: "stretch",
    shadowColor: colors.ink,
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 1,
  },
  unlockText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: "800",
  },
  contactActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
    alignSelf: "stretch",
  },
  contactButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.brand,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  contactButtonPrimary: {
    backgroundColor: colors.brand,
  },
  contactButtonPrimaryText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: "800",
  },
  contactButtonText: {
    color: colors.brand,
    fontSize: 14,
    fontWeight: "800",
  },

  /* ---- Sticky chat CTA ---- */
  ctaBar: {
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.mist,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  chatButton: {
    alignSelf: "stretch",
    minHeight: 54,
    borderRadius: 16,
    backgroundColor: colors.brand,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: colors.ink,
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 1,
  },
  chatButtonText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: "800",
    flexShrink: 1,
  },

  /* ---- Empty / error ---- */

  /* ---- Report (PRD §10.2) ---- */
  reportRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 16,
    alignSelf: "stretch",
    borderWidth: 1,
    borderColor: withAlpha(colors.danger, 0.22),
    borderRadius: 14,
  },
  reportRowText: {
    color: colors.danger,
    fontSize: 12.5,
    fontWeight: "700",
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: withAlpha(colors.ink, 0.45),
    justifyContent: "flex-end",
  },
  sheetBackdropTouch: { flex: 1 },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 40,
  },
  sheetGrabber: {
    alignSelf: "center",
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.mistDark,
    marginBottom: 14,
  },
  sheetTitle: {
    fontSize: 17.5,
    fontWeight: "800",
    letterSpacing: -0.3,
    color: colors.ink,
  },
  sheetSub: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.textMuted,
    marginTop: 4,
    marginBottom: 12,
  },
  reportChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 4,
  },
  reportInput: {
    borderWidth: 1.5,
    borderColor: colors.mist,
    borderRadius: 16,
    backgroundColor: colors.cream,
    padding: 12,
    minHeight: 88,
    textAlignVertical: "top",
    fontSize: 14,
    color: colors.ink,
    marginTop: 8,
  },
  sheetButtons: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  sheetCancel: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.mist,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetCancelText: {
    color: colors.textMuted,
    fontWeight: "700",
    fontSize: 14,
  },
  sheetSubmit: {
    flex: 2,
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  sheetSubmitDisabled: { opacity: 0.45 },
  sheetSubmitText: {
    color: colors.white,
    fontWeight: "800",
    fontSize: 15,
  },
});
