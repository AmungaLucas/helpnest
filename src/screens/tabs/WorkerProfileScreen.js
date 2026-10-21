import React, { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";

import { useAuth } from "../../context/AuthContext";
import { getWorker } from "../../services/workersService";
import Chip from "../../components/ui/Chip";
import TabBarIcon from "../../components/ui/TabBarIcon";
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
        <View style={styles.emptyBadge}>
          <TabBarIcon name="alert-triangle" color={colors.danger} size={20} />
        </View>
        <Text style={styles.emptyTitle}>Profile unavailable</Text>
        <Text style={styles.emptyText}>{error || "Worker not found."}</Text>
        <Pressable
          style={({ pressed }) => [styles.linkButton, pressed && styles.pressed]}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.linkText}>Go back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const firstName = (worker.name || "").split(" ")[0] || "?";
  const kycVerified = worker.kycStatus === "verified";

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.cream} />

      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => navigation.goBack()}
          hitSlop={10}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
        >
          <TabBarIcon name="chevron-left" color={colors.ink} size={22} />
        </Pressable>
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ---- Photo header ---- */}
        <View style={[styles.heroCard, styles.cardShadow]}>
          <View style={styles.heroBackdrop} />

          <SignedImage
            url={worker?.avatarDisplayUrl || worker?.avatarUrl}
            mediaId={worker?.avatarMediaId}
            variant="display"
            fallbackText={firstName}
            style={styles.avatar}
            textStyle={styles.avatarText}
          />

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
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.mist,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    color: colors.ink,
    fontSize: 17,
    fontWeight: "800",
  },
  headerSpacer: {
    width: 42,
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
    padding: 22,
    paddingTop: 30,
    alignItems: "center",
    overflow: "hidden",
  },
  heroBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 96,
    backgroundColor: withAlpha(colors.brand, 0.06),
  },
  avatar: {
    width: 136,
    height: 136,
    borderRadius: 68,
    borderWidth: 3,
    borderColor: withAlpha(colors.brand, 0.18),
    backgroundColor: withAlpha(colors.brand, 0.14),
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    overflow: "hidden",
  },
  avatarText: {
    color: colors.brand,
    fontSize: 52,
    fontWeight: "800",
  },
  name: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.3,
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
    minHeight: 52,
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
    borderWidth: 1.5,
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
  emptyBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: withAlpha(colors.danger, 0.08),
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  emptyTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: "800",
    marginBottom: 6,
    textAlign: "center",
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 13.5,
    lineHeight: 20,
    textAlign: "center",
  },
  linkButton: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  linkText: {
    color: colors.brand,
    fontSize: 14,
    fontWeight: "800",
  },
});
