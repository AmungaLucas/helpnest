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
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";

import { useAuth } from "../../context/AuthContext";
import { getWorker } from "../../services/workersService";
import Chip from "../../components/ui/Chip";
import TabBarIcon from "../../components/ui/TabBarIcon";
import SignedImage from "../../components/media/SignedImage";
import ChatAccessModal from "../../components/ui/ChatAccessModal";
import {
  availabilityLabel,
  serviceLabel,
} from "../../utils/workerMeta";
import { formatDistance } from "../../utils/geo";
import { colors, withAlpha } from "../../theme/colors";

// ---------------------------------------------------------------------------
// Worker profile — 2026-10-20 modernization:
//   photo hero card (name + verified + distance overlaid) -> quick stats ->
//   about -> services -> sticky bottom action bar with the monetized chat
//   CTA ("Chat with {name}") next to the contact actions.
//
// Chat gate: the server computes `worker.chat` (subscription or a paid
// one-time pass for THIS worker). canChat -> straight into ChatRoom;
// otherwise the ChatAccessModal offers one-time chat vs subscription plans.
// After an M-Pesa purchase the focus refetch picks up the entitlement and
// the chat opens by itself (pendingChatRef).
// ---------------------------------------------------------------------------
export default function WorkerProfileScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { params } = useRoute();
  const workerId = params?.workerId;
  const { user } = useAuth();

  const isEmployer = user?.role === "employer";

  const [worker, setWorker] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [gateOpen, setGateOpen] = useState(false);

  // Set when the paywall is opened; if the purchase succeeds and the user
  // comes back, the refetched entitlement auto-opens the chat.
  const pendingChatRef = useRef(false);

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

          if (
            pendingChatRef.current &&
            data.worker?.chat?.canChat
          ) {
            pendingChatRef.current = false;
            navigation.navigate("ChatRoom", {
              name: data.worker.name,
              role: "maid",
            });
          }
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
      name: worker.name,
      role: "maid",
    });
  }, [navigation, worker]);

  const handleChatPress = useCallback(() => {
    if (worker?.chat?.canChat) {
      openChat();
      return;
    }

    pendingChatRef.current = true;
    setGateOpen(true);
  }, [worker, openChat]);

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
        <Text style={styles.emptyTitle}>Profile unavailable</Text>
        <Text style={styles.emptyText}>{error || "Worker not found."}</Text>
        <Pressable style={styles.linkButton} onPress={() => navigation.goBack()}>
          <Text style={styles.linkText}>Go back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const firstName = (worker.name || "").split(" ")[0] || "?";
  const kycVerified = worker.kycStatus === "verified";
  const distance = formatDistance(worker.distanceKm);
  const unlocked = Boolean(worker.contactUnlocked && worker.phone);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.cream} />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: 130 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ---------- Photo hero ---------- */}
        <View style={styles.hero}>
          <SignedImage
            url={worker?.avatarDisplayUrl || worker?.avatarUrl}
            mediaId={worker?.avatarMediaId}
            variant="display"
            fallbackText={firstName}
            style={styles.heroPhoto}
            textStyle={styles.heroFallbackText}
          />

          {/* Legibility veil behind the overlaid name/badges */}
          <View style={styles.heroVeil} pointerEvents="none" />

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={() => navigation.goBack()}
            hitSlop={10}
            style={styles.backButton}
          >
            <TabBarIcon name="chevron-left" color={colors.ink} size={22} />
          </Pressable>

          {kycVerified ? (
            <View style={styles.verifiedPill}>
              <TabBarIcon name="check" color={colors.white} size={10} />
              <Text style={styles.verifiedPillText}>ID verified</Text>
            </View>
          ) : (
            <View style={styles.pendingPill}>
              <Text style={styles.pendingPillText}>Verification in progress</Text>
            </View>
          )}

          <View style={styles.heroFooter} pointerEvents="none">
            <Text style={styles.heroName}>{worker.name}</Text>
            <Text style={styles.heroTitle} numberOfLines={1}>
              {worker.title || "Domestic worker"}
            </Text>
          </View>
        </View>

        {/* ---------- Location + distance chips ---------- */}
        {worker.locationLabel || distance ? (
          <View style={styles.chipRow}>
            {worker.locationLabel ? (
              <View style={styles.areaChip}>
                <TabBarIcon name="map-pin" color={colors.brand} size={11} />
                <Text style={styles.areaChipText} numberOfLines={1}>
                  {worker.locationLabel}
                </Text>
              </View>
            ) : null}
            {distance ? (
              <View style={[styles.areaChip, styles.distanceChip]}>
                <Text style={styles.distanceChipText}>{distance} away</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* ---------- Quick stats ---------- */}
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

        {/* ---------- Unlocked contact (in-scroll, mirrors the bar) ---------- */}
        {unlocked ? (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Contact</Text>
            <Text style={styles.phoneNumber}>
              {formatKenyanPhone(worker.phone)}
            </Text>
            <Text style={styles.contactNote}>
              Reach out directly and mention HelpNest. For everyone's safety,
              keep payments and agreements inside the app.
            </Text>
          </View>
        ) : (
          <View style={styles.unlockTeaser}>
            <TabBarIcon name="shield" color={colors.brand} size={15} />
            <Text style={styles.unlockTeaserText}>
              {firstName}'s number stays private. Unlock it with M-Pesa when
              you're ready to talk.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* ---------- Sticky bottom action bar ---------- */}
      <View
        style={[styles.actionBar, { paddingBottom: 14 + insets.bottom }]}
      >
        {isEmployer ? (
          <>
            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.chatButton,
                pressed && styles.pressedDark,
              ]}
              onPress={handleChatPress}
            >
              <TabBarIcon name="message-circle" color={colors.white} size={17} />
              <Text style={styles.chatButtonText} numberOfLines={1}>
                Chat with {firstName}
              </Text>
            </Pressable>

            {unlocked ? (
              <>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Call"
                  style={styles.roundAction}
                  onPress={() =>
                    Linking.openURL(`tel:${normalizeDialNumber(worker.phone)}`)
                  }
                >
                  <TabBarIcon name="phone" color={colors.brand} size={17} />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Send SMS"
                  style={styles.roundAction}
                  onPress={() =>
                    Linking.openURL(`sms:${normalizeDialNumber(worker.phone)}`)
                  }
                >
                  <TabBarIcon name="message-circle" color={colors.brand} size={17} />
                </Pressable>
              </>
            ) : (
              <Pressable
                accessibilityRole="button"
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
                <Text style={styles.unlockButtonText}>Unlock · KES 300</Text>
              </Pressable>
            )}
          </>
        ) : unlocked ? (
          <>
            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.chatButton,
                pressed && styles.pressedDark,
              ]}
              onPress={() =>
                Linking.openURL(`tel:${normalizeDialNumber(worker.phone)}`)
              }
            >
              <TabBarIcon name="phone" color={colors.white} size={17} />
              <Text style={styles.chatButtonText}>Call {firstName}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Send SMS"
              style={styles.roundAction}
              onPress={() =>
                Linking.openURL(`sms:${normalizeDialNumber(worker.phone)}`)
              }
            >
              <TabBarIcon name="message-circle" color={colors.brand} size={17} />
            </Pressable>
          </>
        ) : null}
      </View>

      <ChatAccessModal
        visible={gateOpen}
        onClose={() => setGateOpen(false)}
        workerName={worker.name}
        workerId={worker.id}
      />
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
  scroll: {
    padding: 20,
    paddingBottom: 40,
  },

  /* ---- Photo hero ---- */
  hero: {
    height: 250,
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: withAlpha(colors.brand, 0.14),
  },
  heroPhoto: {
    width: "100%",
    height: "100%",
  },
  heroFallbackText: {
    color: colors.brand,
    fontSize: 64,
    fontWeight: "800",
  },
  heroVeil: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(24, 32, 27, 0.28)",
  },
  backButton: {
    position: "absolute",
    top: 12,
    left: 12,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.cream,
    alignItems: "center",
    justifyContent: "center",
    elevation: 3,
  },
  verifiedPill: {
    position: "absolute",
    top: 14,
    right: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.brand,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  verifiedPillText: {
    color: colors.white,
    fontSize: 10.5,
    fontWeight: "800",
  },
  pendingPill: {
    position: "absolute",
    top: 14,
    right: 14,
    backgroundColor: withAlpha(colors.gold, 0.92),
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  pendingPillText: {
    color: colors.ink,
    fontSize: 10.5,
    fontWeight: "800",
  },
  heroFooter: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 14,
  },
  heroName: {
    color: colors.white,
    fontSize: 24,
    fontWeight: "800",
    textShadowColor: "rgba(0, 0, 0, 0.35)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  heroTitle: {
    color: withAlpha("#FFFFFF", 0.92),
    fontSize: 13.5,
    fontWeight: "700",
    marginTop: 2,
    textShadowColor: "rgba(0, 0, 0, 0.35)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },

  /* ---- Area chips ---- */
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 14,
  },
  areaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.mistDark,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 6,
    maxWidth: "100%",
  },
  areaChipText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "700",
    flexShrink: 1,
  },
  distanceChip: {
    backgroundColor: withAlpha(colors.brand, 0.1),
    borderColor: "transparent",
  },
  distanceChipText: {
    color: colors.brand,
    fontSize: 12,
    fontWeight: "800",
  },

  /* ---- Stats ---- */
  statsRow: {
    flexDirection: "row",
    marginTop: 14,
  },
  statBox: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.mist,
    paddingVertical: 13,
    paddingHorizontal: 8,
    alignItems: "center",
    marginHorizontal: 4,
  },
  statValue: {
    color: colors.ink,
    fontSize: 13.5,
    fontWeight: "800",
    textAlign: "center",
  },
  statLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "600",
    marginTop: 3,
    textAlign: "center",
  },

  /* ---- Sections ---- */
  sectionCard: {
    backgroundColor: colors.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.mist,
    padding: 16,
    marginTop: 14,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 8,
  },
  bioText: {
    color: colors.textMuted,
    fontSize: 13.5,
    lineHeight: 21,
  },
  chipsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  phoneNumber: {
    color: colors.brand,
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  contactNote: {
    color: colors.textMuted,
    fontSize: 12.5,
    lineHeight: 19,
  },
  unlockTeaser: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.mist,
    padding: 16,
    marginTop: 14,
  },
  unlockTeaserText: {
    flex: 1,
    color: colors.textMuted,
    fontSize: 12.5,
    lineHeight: 19,
  },

  /* ---- Bottom action bar ---- */
  actionBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.mist,
  },
  chatButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 15,
    backgroundColor: colors.brand,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 12,
  },
  chatButtonText: {
    color: colors.white,
    fontSize: 14.5,
    fontWeight: "800",
    flexShrink: 1,
  },
  unlockButton: {
    minHeight: 52,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  unlockButtonText: {
    color: colors.brand,
    fontSize: 13,
    fontWeight: "800",
  },
  roundAction: {
    width: 52,
    height: 52,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.85,
  },
  pressedDark: {
    opacity: 0.92,
  },

  /* ---- Empty / error ---- */
  emptyTitle: {
    color: colors.ink,
    fontSize: 16,
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
    marginTop: 14,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  linkText: {
    color: colors.brand,
    fontSize: 14,
    fontWeight: "800",
  },
});
