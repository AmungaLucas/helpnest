import React, { useCallback, useState } from "react";
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
import SignedImage from "../../components/media/SignedImage";
import { colors, withAlpha } from "../../theme/colors";
import {
  availabilityLabel,
  serviceLabel,
} from "../../utils/workerMeta";
import { formatDistance } from "../../utils/geo";

const SERVICE_EMOJI = {
  cleaning: "🧹",
  cooking: "🍳",
  childcare: "🧒",
  laundry: "👕",
  elderly_care: "🫶",
  housekeeping: "🏠",
};

// ---------------------------------------------------------------------------
// Worker profile — "Inverse Dark Hero + Floating Card".
//   Dark brand hero carries identity. A white card floats up 40px into it
//   holding all the data (rate / exp / availability / about / services).
//   All data flow / chat gate / report sheet logic is unchanged.
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

  const [reportOpen, setReportOpen] = useState(false);
  const [reportCategory, setReportCategory] = useState(null);
  const [reportNote, setReportNote] = useState("");
  const [reportBusy, setReportBusy] = useState(false);

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
  const distanceLabel = formatDistance(worker.distanceKm);

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
        {/* ---- Dark brand hero ---- */}
        <View style={styles.heroPanel}>
          <View style={styles.heroOrb1} />
          <View style={styles.heroOrb2} />

          <View style={styles.heroTopRow}>
            <View
              style={[
                styles.statusChip,
                kycVerified ? styles.statusChipBrand : styles.statusChipGold,
              ]}
            >
              <TabBarIcon
                name={kycVerified ? "shield-check" : "clock"}
                color={kycVerified ? colors.gold : colors.goldDark}
                size={11}
              />
              <Text
                style={[
                  styles.statusChipText,
                  kycVerified
                    ? styles.statusChipTextBrand
                    : styles.statusChipTextGold,
                ]}
              >
                {kycVerified ? "VERIFIED · KYC" : "VERIFICATION PENDING"}
              </Text>
            </View>

            {distanceLabel ? (
              <View style={styles.distanceChip}>
                <TabBarIcon
                  name="navigation"
                  color={withAlpha(colors.white, 0.85)}
                  size={9}
                />
                <Text style={styles.distanceChipText}>{distanceLabel}</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.heroPhotoWrap}>
            <SignedImage
              url={worker?.avatarDisplayUrl || worker?.avatarUrl}
              mediaId={worker?.avatarMediaId}
              variant="display"
              fallbackText={firstName}
              style={styles.heroPhoto}
              textStyle={styles.heroPhotoText}
            />
          </View>

          <Text style={styles.heroName} numberOfLines={2}>
            {worker.name}
          </Text>
          <Text style={styles.heroRole} numberOfLines={1}>
            {worker.title || "Domestic worker"}
            {worker.locationLabel ? ` · ${worker.locationLabel}` : ""}
          </Text>
        </View>

        {/* ---- Floating white card ---- */}
        <View style={styles.profileCard}>
          {/* Facts strip */}
          <View style={styles.factsRow}>
            <View style={styles.factCell}>
              <Text style={styles.factEyebrow}>RATE</Text>
              <Text style={styles.factValue} numberOfLines={1}>
                {worker.hourlyRate !== null
                  ? `KES ${worker.hourlyRate}`
                  : "On ask"}
              </Text>
              <Text style={styles.factUnit}>
                {worker.hourlyRate !== null ? "per hour" : "negotiable"}
              </Text>
            </View>
            <View style={styles.factRule} />
            <View style={styles.factCell}>
              <Text style={styles.factEyebrow}>EXPERIENCE</Text>
              <Text style={styles.factValue} numberOfLines={1}>
                {worker.experienceYears !== null
                  ? `${worker.experienceYears} yr${
                      worker.experienceYears === 1 ? "" : "s"
                    }`
                  : "New"}
              </Text>
              <Text style={styles.factUnit}>
                {worker.experienceYears !== null ? "on the job" : "just joined"}
              </Text>
            </View>
            <View style={styles.factRule} />
            <View style={styles.factCell}>
              <Text style={styles.factEyebrow}>AVAILABLE</Text>
              <Text style={styles.factValue} numberOfLines={1}>
                {worker.availability
                  ? availabilityLabel(worker.availability)
                  : "—"}
              </Text>
              <Text style={styles.factUnit}>schedule</Text>
            </View>
          </View>

          {/* About */}
          {worker.bio ? (
            <>
              <View style={styles.cardHairline} />
              <Text style={styles.cardEyebrow}>ABOUT</Text>
              <Text style={styles.bioText}>{worker.bio}</Text>
            </>
          ) : null}

          {/* Services */}
          {worker.services.length > 0 ? (
            <>
              <View style={styles.cardHairline} />
              <Text style={styles.cardEyebrow}>SERVICES</Text>
              <View style={styles.servicesWrap}>
                {worker.services.map((value) => (
                  <View key={value} style={styles.servicePill}>
                    <Text style={styles.serviceEmoji}>
                      {SERVICE_EMOJI[value] || "✨"}
                    </Text>
                    <Text style={styles.servicePillText}>
                      {serviceLabel(value)}
                    </Text>
                  </View>
                ))}
              </View>
            </>
          ) : null}
        </View>

        {/* ---- Contact ---- */}
        {worker.contactUnlocked && worker.phone ? (
          <View style={styles.contactCardUnlocked}>
            <View style={styles.contactHead}>
              <View style={styles.contactHeadIconSuccess}>
                <TabBarIcon
                  name="shield-check"
                  color={colors.brand}
                  size={14}
                />
              </View>
              <Text style={styles.contactHeadTextSuccess}>CONTACT UNLOCKED</Text>
            </View>

            <Text style={styles.contactPhone}>
              {formatKenyanPhone(worker.phone)}
            </Text>
            <Text style={styles.contactNote}>
              Reach out directly and mention HelpNest. For everyone's safety,
              keep payments and agreements inside the app once messaging
              launches.
            </Text>

            <View style={styles.contactActions}>
              <Pressable
                accessibilityRole="button"
                android_ripple={{ color: withAlpha(colors.white, 0.14) }}
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
                  Linking.openURL(`sms:${normalizeDialNumber(worker.phone)}`)
                }
              >
                <TabBarIcon
                  name="message-circle"
                  color={colors.brand}
                  size={15}
                />
                <Text style={styles.contactButtonText}>SMS</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.contactCardLocked}>
            <View style={styles.contactHead}>
              <View style={styles.contactHeadIconLocked}>
                <TabBarIcon name="lock" color={colors.goldDark} size={14} />
              </View>
              <Text style={styles.contactHeadTextLocked}>CONTACT PRIVATE</Text>
            </View>

            <Text style={styles.contactLockedTitle}>
              Unlock {firstName}'s phone number
            </Text>
            <Text style={styles.contactNote}>
              Arrange work directly, paid via M-Pesa. Workers control who sees
              their number.
            </Text>

            <Pressable
              accessibilityRole="button"
              android_ripple={{ color: withAlpha(colors.white, 0.14) }}
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
              <TabBarIcon name="lock" color={colors.white} size={14} />
              <Text style={styles.unlockText}>Unlock · KES 300</Text>
            </Pressable>
          </View>
        )}

        {/* ---- Report row ---- */}
        {user && worker.id !== user.id ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Report this profile"
            style={({ pressed }) => [
              styles.reportRow,
              pressed && styles.pressed,
            ]}
            onPress={() => setReportOpen(true)}
          >
            <TabBarIcon name="flag" color={colors.danger} size={13} />
            <Text style={styles.reportRowText}>Report this profile</Text>
          </Pressable>
        ) : null}
      </ScrollView>

      {/* ---- Chat CTA ---- */}
      {isEmployer ? (
        <View style={styles.ctaBar}>
          <Pressable
            accessibilityRole="button"
            android_ripple={{ color: withAlpha(colors.white, 0.14) }}
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

      {/* ---- Report sheet ---- */}
      <Modal
        transparent
        visible={reportOpen}
        animationType="slide"
        onRequestClose={() => setReportOpen(false)}
      >
        <View style={styles.sheetBackdrop}>
          <Pressable
            style={styles.sheetBackdropTouch}
            onPress={() => setReportOpen(false)}
          />
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
                disabled={
                  reportBusy ||
                  !reportCategory ||
                  reportNote.trim().length < 10
                }
                style={({ pressed }) => [
                  styles.sheetSubmit,
                  (reportBusy ||
                    !reportCategory ||
                    reportNote.trim().length < 10) &&
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

function normalizeDialNumber(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (/^0\d{9}$/.test(digits)) return `+254${digits.slice(1)}`;
  if (/^\d{9}$/.test(digits)) return `+254${digits}`;
  return `+${digits}`;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.cream },
  center: { alignItems: "center", justifyContent: "center", padding: 32 },
  pressed: { opacity: 0.9 },

  reportFlagBtn: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: withAlpha(colors.danger, 0.08),
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },

  scroll: {
    paddingHorizontal: 20,
    paddingTop: 0,
    paddingBottom: 28,
  },

  /* ============================================================
     Dark brand hero — inverted palette, gold accents, centered
     circular portrait.
     ============================================================ */
  heroPanel: {
    backgroundColor: colors.brand,
    marginHorizontal: -20,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 60,
    overflow: "hidden",
  },
  heroOrb1: {
    position: "absolute",
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: withAlpha(colors.gold, 0.1),
    top: -130,
    right: -80,
  },
  heroOrb2: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: withAlpha(colors.gold, 0.06),
    bottom: -40,
    left: -70,
  },

  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 10,
  },
  statusChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusChipBrand: {
    backgroundColor: withAlpha(colors.gold, 0.16),
  },
  statusChipGold: {
    backgroundColor: withAlpha(colors.gold, 0.16),
  },
  statusChipText: {
    fontSize: 9.5,
    fontWeight: "800",
    letterSpacing: 1,
  },
  statusChipTextBrand: { color: colors.gold },
  statusChipTextGold: { color: colors.gold },

  distanceChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: withAlpha(colors.white, 0.14),
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  distanceChipText: {
    color: colors.white,
    fontSize: 10.5,
    fontWeight: "700",
    letterSpacing: 0.1,
  },

  heroPhotoWrap: {
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 16,
    padding: 4,
    borderRadius: 58,
    backgroundColor: colors.white,
    shadowColor: colors.ink,
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  heroPhoto: {
    width: 104,
    height: 104,
    borderRadius: 52,
    overflow: "hidden",
    backgroundColor: withAlpha(colors.brand, 0.3),
  },
  heroPhotoText: {
    color: colors.white,
    fontSize: 36,
    fontWeight: "800",
  },

  heroName: {
    color: colors.white,
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.6,
    lineHeight: 28,
    textAlign: "center",
  },
  heroRole: {
    color: withAlpha(colors.white, 0.72),
    fontSize: 13,
    fontWeight: "600",
    marginTop: 4,
    textAlign: "center",
  },

  /* ============================================================
     Floating white profile card — overlaps the dark hero.
     ============================================================ */
  profileCard: {
    backgroundColor: colors.white,
    borderRadius: 22,
    padding: 18,
    marginTop: -40,
    marginBottom: 16,
    shadowColor: colors.ink,
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },

  /* ---- Facts strip ---- */
  factsRow: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  factCell: {
    flex: 1,
    alignItems: "center",
  },
  factEyebrow: {
    color: colors.textFaint,
    fontSize: 8.5,
    fontWeight: "800",
    letterSpacing: 1.1,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  factValue: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: -0.2,
    textAlign: "center",
  },
  factUnit: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "600",
    marginTop: 2,
    textAlign: "center",
  },
  factRule: {
    width: 1,
    backgroundColor: withAlpha(colors.ink, 0.08),
    marginHorizontal: 6,
    marginVertical: 2,
  },

  /* ---- Card subsections ---- */
  cardHairline: {
    height: 1,
    backgroundColor: withAlpha(colors.ink, 0.06),
    marginVertical: 14,
  },
  cardEyebrow: {
    color: colors.goldDark,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.4,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  bioText: {
    color: colors.ink,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "500",
  },
  servicesWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
  },
  servicePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: withAlpha(colors.brand, 0.08),
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  serviceEmoji: { fontSize: 12 },
  servicePillText: {
    color: colors.brand,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: -0.1,
  },

  /* ============================================================
     Contact cards.
     ============================================================ */
  contactCardUnlocked: {
    backgroundColor: withAlpha(colors.brand, 0.07),
    borderRadius: 20,
    borderWidth: 1,
    borderColor: withAlpha(colors.brand, 0.14),
    padding: 18,
    marginBottom: 16,
  },
  contactCardLocked: {
    backgroundColor: colors.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: withAlpha(colors.gold, 0.35),
    borderStyle: "dashed",
    padding: 18,
    marginBottom: 16,
  },
  contactHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  contactHeadIconSuccess: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: withAlpha(colors.brand, 0.16),
    alignItems: "center",
    justifyContent: "center",
  },
  contactHeadIconLocked: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: withAlpha(colors.gold, 0.2),
    alignItems: "center",
    justifyContent: "center",
  },
  contactHeadTextSuccess: {
    color: colors.brand,
    fontSize: 9.5,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  contactHeadTextLocked: {
    color: colors.goldDark,
    fontSize: 9.5,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  contactLockedTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: -0.3,
    marginBottom: 6,
  },
  contactPhone: {
    color: colors.ink,
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: 0.2,
    marginBottom: 8,
  },
  contactNote: {
    color: colors.textMuted,
    fontSize: 12.5,
    lineHeight: 19,
  },
  contactActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  contactButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.brand,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    overflow: "hidden",
  },
  contactButtonPrimary: { backgroundColor: colors.brand },
  contactButtonPrimaryText: {
    color: colors.white,
    fontSize: 13.5,
    fontWeight: "800",
  },
  contactButtonText: {
    color: colors.brand,
    fontSize: 13.5,
    fontWeight: "800",
  },
  unlockButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.brand,
    borderRadius: 12,
    minHeight: 50,
    marginTop: 14,
    overflow: "hidden",
  },
  unlockText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: "800",
  },

  reportRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
  },
  reportRowText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: "700",
  },

  /* ============================================================
     Chat CTA bar.
     ============================================================ */
  ctaBar: {
    backgroundColor: colors.cream,
    borderTopWidth: 1,
    borderTopColor: withAlpha(colors.ink, 0.06),
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14,
  },
  chatButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: colors.brand,
    minHeight: 54,
    borderRadius: 16,
    paddingHorizontal: 20,
    overflow: "hidden",
    shadowColor: colors.ink,
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  chatButtonText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: -0.1,
    flexShrink: 1,
  },

  /* ============================================================
     Report sheet (unchanged).
     ============================================================ */
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
    gap: 6,
    marginBottom: 4,
  },
  reportInput: {
    borderWidth: 1,
    borderColor: withAlpha(colors.ink, 0.08),
    borderRadius: 14,
    backgroundColor: withAlpha(colors.ink, 0.04),
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
    borderColor: withAlpha(colors.ink, 0.1),
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