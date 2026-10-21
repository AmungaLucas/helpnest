import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StatusBar,
  Switch,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";

import { useAuth } from "../../context/AuthContext";
import { logout } from "../../services/authService";
import { updateMe } from "../../services/usersService";
import { uploadMedia } from "../../services/mediaService";
import { fetchNotifications } from "../../services/notificationsService";
import SignedImage from "../../components/media/SignedImage";
import {
  openAppSettings,
  requestAndFetchLocation,
} from "../../utils/location";
import HamburgerButton from "../../components/ui/HamburgerButton";
import TabBarIcon from "../../components/ui/TabBarIcon";
import { registerCaptureCallback } from "../../utils/captureCallback";
import { colors, withAlpha } from "../../theme/colors";

const ROLE_LABELS = {
  maid: "Domestic Worker",
  employer: "Employer",
  admin: "Admin",
};

export default function AccountScreen() {
  const navigation = useNavigation();
  const { user, clearSession, updateUser } = useAuth();
  const [locating, setLocating] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [unread, setUnread] = useState(0);
  // §17.2 — email fan-out preference. Server default is on; undefined on
  // stale sessions behaves the same (opt-out is an explicit flip).
  const [emailUpdates, setEmailUpdates] = useState(user?.notifyEmail !== false);
  const [emailPrefBusy, setEmailPrefBusy] = useState(false);

  // Unread notifications count (§17) — re-checked every time the tab
  // regains focus so returning from the feed clears the badge.
  const loadUnread = useCallback(() => {
    fetchNotifications()
      .then((d) => setUnread(d.unread || 0))
      .catch(() => setUnread(0));
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadUnread();
    }, [loadUnread])
  );

  // §17.2 — toggle gated notification emails. Security/transactional mail
  // (payments, account status, KYC outcomes) is always sent regardless.
  async function toggleEmailUpdates(next) {
    if (emailPrefBusy) return;
    setEmailPrefBusy(true);
    const prev = emailUpdates;
    setEmailUpdates(next); // optimistic
    try {
      await updateMe({ notifyEmail: next });
      updateUser({ notifyEmail: next });
    } catch (error) {
      setEmailUpdates(prev); // revert on failure
      Alert.alert(
        "Could not update",
        error?.message || "Please try again in a moment."
      );
    } finally {
      setEmailPrefBusy(false);
    }
  }

  const firstName = (user?.name || "").split(" ")[0] || "?";
  const hasCoords = user?.locationLat !== null && user?.locationLat !== undefined;

  // Verified pills for the identity header (visual mirror of the rows in
  // the Verification card below).
  const verifiedChips = [
    user?.phoneVerified ? "Phone verified" : null,
    user?.emailVerified ? "Email verified" : null,
    user?.kycStatus === "verified" ? "ID verified" : null,
  ].filter(Boolean);

  function confirmSignOut() {
    Alert.alert(
      "Sign out",
      "You'll need to log in again to access your HelpNest account.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Sign out", style: "destructive", onPress: handleSignOut },
      ]
    );
  }

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);

    try {
      await logout();
    } catch (error) {
      // Clear locally regardless.
    }

    clearSession();
    // RootNavigator swaps the authed stack for the guest stack whenever
    // `user` flips to null — no explicit navigation needed (a reset
    // dispatched from inside the drawer navigator would target the wrong
    // navigator anyway). The guest stack opens directly on Login (the
    // device already has an account), per the PRD §5 sign-out flow.
    setSigningOut(false);
  }

  // Profile photo flow (2026-10-20): the user chooses camera or gallery —
  // the guided camera starts on the FRONT lens with flip to the back one and
  // a circular avatar guide. Gallery picks + camera captures pass a review
  // stop (KYCCamera has its own Retake/Use step; gallery goes to ImageReview)
  // so nothing uploads until the user confirms. Upload re-encodes to JPEG
  // client-side (iPhone HEIC never reaches the API). The response carries the
  // refreshed user incl. profileMediaId — merged into the cached session so
  // drawer/list avatars update immediately.
  async function uploadProfilePhoto(uri) {
    if (uploadingPhoto) return;

    setUploadingPhoto(true);

    try {
      const response = await uploadMedia({
        uri,
        kind: "profile",
      });

      if (response.user) updateUser(response.user);
    } catch (error) {
      Alert.alert(
        "Could not update photo",
        error?.message || "Please try again in a moment."
      );
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function pickProfileFromGallery() {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        exif: false,
      });

      if (result.canceled || !result.assets?.length) return;

      navigation.navigate("ImageReview", {
        uri: result.assets[0].uri,
        title: "Profile photo",
        subtitle:
          "This becomes your profile picture — visible to employers and workers.",
        useId: registerCaptureCallback((uri) => uploadProfilePhoto(uri)),
      });
    } catch (error) {
      Alert.alert(
        "Could not open the photo picker",
        "Please try again in a moment."
      );
    }
  }

  function chooseProfileSource() {
    if (uploadingPhoto) return;

    Alert.alert(
      "Profile photo",
      "Take a new photo, or pick one you already have.",
      [
        {
          text: "Take photo",
          onPress: () =>
            navigation.navigate("KYCCamera", {
              docKind: "profile",
              captureId: registerCaptureCallback((uri) =>
                uploadProfilePhoto(uri)
              ),
            }),
        },
        { text: "Choose from gallery", onPress: pickProfileFromGallery },
        { text: "Cancel", style: "cancel" },
      ],
      { cancelable: true }
    );
  }

  async function handleUseLocation() {
    if (locating) return;
    setLocating(true);

    try {
      const coords = await requestAndFetchLocation();
      await updateMe(coords);
      updateUser(coords);
    } catch (error) {
      if (error?.code === "PERMISSION_DENIED") {
        Alert.alert("Location permission needed", error.message, [
          { text: "Not now", style: "cancel" },
          ...(error.canAskAgain
            ? []
            : [{ text: "Open settings", onPress: () => openAppSettings() }]),
        ]);
      } else {
        Alert.alert(
          "Could not get location",
          error?.message || "Please try again in a moment."
        );
      }
    } finally {
      setLocating(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.cream} />

      {/* Sticky header — the drawer toggle stays reachable while the
          profile content scrolls beneath it. */}
      <View style={styles.menuRow}>
        <HamburgerButton />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* =====================================================
            Sage hero — full-bleed, square edges, orbs glow through.
            ===================================================== */}
        <View style={styles.heroPanel}>
          <View style={styles.orb1} />
          <View style={styles.orb2} />
          <View style={styles.orb3} />

          <View style={styles.heroRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Change profile photo"
              style={({ pressed }) => [
                styles.heroAvatar,
                pressed && styles.pressed,
              ]}
              onPress={chooseProfileSource}
              disabled={uploadingPhoto}
            >
              {/* Elevation lives on this opaque wrapper — Android renders
                  elevation THROUGH translucent fills (dark silhouette), so
                  the tinted avatar itself must stay elevation-free. */}
              <View style={styles.avatarShadow}>
                <SignedImage
                  mediaId={user?.profileMediaId}
                  variant="thumb"
                  fallbackText={firstName}
                  style={styles.avatar}
                  textStyle={styles.avatarText}
                />
              </View>
              <View style={styles.avatarBadge}>
                {uploadingPhoto ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <TabBarIcon name="camera" color={colors.white} size={12} />
                )}
              </View>
            </Pressable>

            <View style={styles.heroInfo}>
              <Text style={styles.name} numberOfLines={1}>
                {user?.name}
              </Text>
              <Text style={styles.roleLine} numberOfLines={1}>
                {ROLE_LABELS[user?.role] || user?.role || "Member"} ·{" "}
                {user?.phone}
              </Text>
              {verifiedChips.length > 0 ? (
                <View style={styles.chipRow}>
                  {verifiedChips.map((chip) => (
                    <View key={chip} style={styles.verifiedChip}>
                      <TabBarIcon
                        name="check"
                        color={colors.brand}
                        size={10}
                      />
                      <Text style={styles.verifiedChipText}>{chip}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          </View>
        </View>

        {/* =====================================================
            Chapter 01 — Activity (Notifications)
            ===================================================== */}
        <View style={styles.chapterHead}>
          <Text style={styles.chapterNum}>01</Text>
          <View style={styles.chapterMain}>
            <Text style={styles.chapterEyebrow}>ACTIVITY</Text>
            <Text style={styles.chapterTitle}>Notifications</Text>
          </View>
          {unread > 0 ? (
            <View style={styles.chapterBadge}>
              <Text style={styles.chapterBadgeText}>
                {unread > 99 ? "99+" : unread}
              </Text>
            </View>
          ) : null}
        </View>

        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.card,
            styles.cardTappable,
            pressed && styles.pressed,
          ]}
          onPress={() => navigation.navigate("Notifications")}
          android_ripple={{ color: withAlpha(colors.brand, 0.08) }}
        >
          <View style={styles.notifRow}>
            <View style={styles.menuIcon}>
              <TabBarIcon name="bell" color={colors.brand} size={18} />
            </View>
            <Text style={styles.menuNote} numberOfLines={2}>
              {unread > 0
                ? `${unread} unread update${unread === 1 ? "" : "s"} — verification, payments and applications.`
                : "Verification, payments and account updates land here."}
            </Text>
            <Text style={styles.menuChevron}>›</Text>
          </View>
        </Pressable>

        {/* =====================================================
            Chapter 02 — Preferences (Email updates)
            ===================================================== */}
        {user?.email ? (
          <>
            <View style={styles.chapterHead}>
              <Text style={styles.chapterNum}>02</Text>
              <View style={styles.chapterMain}>
                <Text style={styles.chapterEyebrow}>PREFERENCES</Text>
                <Text style={styles.chapterTitle}>Email updates</Text>
              </View>
            </View>

            <View style={styles.card}>
              <View style={styles.notifRow}>
                <View style={styles.menuIcon}>
                  {/* "mail" isn't in the TabBarIcon set — "send" carries
                      the email-fanout semantics on the approved list. */}
                  <TabBarIcon name="send" color={colors.brand} size={18} />
                </View>
                <Text style={styles.menuNote} numberOfLines={3}>
                  Application, job and promotion emails. Security notices
                  always come through.
                </Text>
                <Switch
                  value={emailUpdates}
                  onValueChange={toggleEmailUpdates}
                  disabled={emailPrefBusy}
                  trackColor={{ false: colors.mist, true: colors.brand }}
                  thumbColor={colors.white}
                  ios_backgroundColor={colors.mist}
                />
              </View>
            </View>
          </>
        ) : null}

        {/* =====================================================
            Chapter 03 — Your area (Location)
            ===================================================== */}
        <View style={styles.chapterHead}>
          <Text style={styles.chapterNum}>{user?.email ? "03" : "02"}</Text>
          <View style={styles.chapterMain}>
            <Text style={styles.chapterEyebrow}>YOUR AREA</Text>
            <Text style={styles.chapterTitle}>Location</Text>
          </View>
        </View>

        <View style={styles.card}>
          {hasCoords ? (
            <Text style={styles.locationLine} numberOfLines={2}>
              {user?.locationLabel ? `${user.locationLabel} · ` : ""}
              {Number(user.locationLat).toFixed(4)},{" "}
              {Number(user.locationLng).toFixed(4)}
            </Text>
          ) : null}
          <Text style={styles.menuNote} numberOfLines={3}>
            {hasCoords
              ? "Used to show you nearby workers and jobs — never your exact address."
              : "Add your general location so we can match you with work and workers nearby. Your exact address is never shared."}
          </Text>

          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed && styles.pressed,
            ]}
            onPress={handleUseLocation}
            disabled={locating}
            android_ripple={{ color: withAlpha(colors.brand, 0.08) }}
          >
            {locating ? (
              <ActivityIndicator color={colors.brand} />
            ) : (
              <Text style={styles.secondaryButtonText}>
                {hasCoords ? "Update my location" : "Use my current location"}
              </Text>
            )}
          </Pressable>
        </View>

        {/* =====================================================
            Chapter 04 — Payments (M-Pesa)
            ===================================================== */}
        <View style={styles.chapterHead}>
          <Text style={styles.chapterNum}>
            {user?.email ? "04" : "03"}
          </Text>
          <View style={styles.chapterMain}>
            <Text style={styles.chapterEyebrow}>PAYMENTS</Text>
            <Text style={styles.chapterTitle}>M-Pesa</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.menuNote} numberOfLines={3}>
            M-Pesa is wired up. Try a KES 1 test payment to confirm STK push
            works on your phone before real pricing goes live.
          </Text>

          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed && styles.pressed,
            ]}
            onPress={() =>
              navigation.navigate("MpesaCheckout", {
                plan: "test_kes1",
                label: "M-Pesa test payment",
              })
            }
            android_ripple={{ color: withAlpha(colors.brand, 0.08) }}
          >
            <Text style={styles.secondaryButtonText}>
              Try a KES 1 test payment
            </Text>
          </Pressable>
        </View>

        <Text style={styles.versionText}>HelpNest v1.0.0</Text>
      </ScrollView>

      {/* Sticky sign-out bar — soft ghost-destructive, cream footer. */}
      <View style={styles.signOutBar}>
        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.signOutButton,
            pressed && styles.pressed,
          ]}
          onPress={confirmSignOut}
          disabled={signingOut}
          android_ripple={{ color: withAlpha(colors.danger, 0.08) }}
        >
          <View style={styles.signOutIcon}>
            <TabBarIcon name="user-x" color={colors.danger} size={13} />
          </View>
          <Text style={styles.signOutText}>
            {signingOut ? "Signing out…" : "Sign out"}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  /* ---- Shell ---- */
  safeArea: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 0,
    paddingBottom: 28,
  },
  pressed: {
    opacity: 0.88,
  },
  menuRow: {
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 10,
    backgroundColor: colors.cream,
  },

  /* ============================================================
     Sage hero panel — full-bleed, square edges, no shadow.
     ============================================================ */
  heroPanel: {
    backgroundColor: colors.mist,
    marginHorizontal: -20,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    marginBottom: 24,
    overflow: "hidden",
  },
  orb1: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: withAlpha(colors.brand, 0.09),
    top: -110,
    right: -70,
  },
  orb2: {
    position: "absolute",
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: withAlpha(colors.gold, 0.16),
    bottom: -60,
    left: -50,
  },
  orb3: {
    position: "absolute",
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: withAlpha(colors.brand, 0.06),
    bottom: 30,
    right: 30,
  },
  heroRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    zIndex: 1,
  },
  heroAvatar: {
    position: "relative",
  },
  avatarShadow: {
    borderRadius: 20,
    backgroundColor: colors.white,
    alignSelf: "flex-start",
    shadowColor: colors.ink,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: withAlpha(colors.brand, 0.14),
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarBadge: {
    position: "absolute",
    right: -3,
    bottom: -3,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.brand,
    borderWidth: 2.5,
    borderColor: colors.mist,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: colors.brand,
    fontSize: 28,
    fontWeight: "800",
  },
  heroInfo: {
    flex: 1,
  },
  name: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  roleLine: {
    color: colors.textMuted,
    fontSize: 12.5,
    fontWeight: "600",
    marginTop: 3,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 10,
  },
  verifiedChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: withAlpha(colors.brand, 0.1),
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  verifiedChipText: {
    color: colors.brand,
    fontSize: 10.5,
    fontWeight: "800",
  },

  /* ============================================================
     Chapter heads — numbered like the Home "How it works" step list.
     ============================================================ */
  chapterHead: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginTop: 4,
    marginBottom: 10,
  },
  chapterNum: {
    color: colors.cloud,
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: -1,
    width: 44,
    lineHeight: 32,
  },
  chapterMain: {
    flex: 1,
    paddingBottom: 2,
  },
  chapterEyebrow: {
    color: colors.goldDark,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.3,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  chapterTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  chapterBadge: {
    backgroundColor: colors.gold,
    borderRadius: 999,
    minWidth: 24,
    height: 24,
    paddingHorizontal: 7,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 3,
  },
  chapterBadgeText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: "800",
  },

  /* ============================================================
     Cards — content-only (title lives in the chapter head).
     ============================================================ */
  card: {
    backgroundColor: colors.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: withAlpha(colors.ink, 0.05),
    padding: 16,
    marginBottom: 22,
    shadowColor: colors.ink,
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  cardTappable: {
    overflow: "hidden",
  },
  notifRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  menuIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: withAlpha(colors.brand, 0.1),
    alignItems: "center",
    justifyContent: "center",
  },
  menuNote: {
    flex: 1,
    color: colors.textMuted,
    fontSize: 12.5,
    lineHeight: 18,
    fontWeight: "600",
  },
  menuChevron: {
    color: colors.textFaint,
    fontSize: 22,
    fontWeight: "700",
    marginLeft: 2,
  },

  /* ---- Location + Payments cards ---- */
  locationLine: {
    color: colors.ink,
    fontSize: 13.5,
    fontWeight: "800",
    marginBottom: 6,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: colors.brand,
    borderRadius: 14,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    overflow: "hidden",
    marginTop: 12,
  },
  secondaryButtonText: {
    color: colors.brand,
    fontSize: 13.5,
    fontWeight: "800",
  },

  /* ---- Version ---- */
  versionText: {
    color: colors.textFaint,
    fontSize: 11,
    fontWeight: "600",
    textAlign: "center",
    marginTop: -4,
  },

  /* ============================================================
     Sticky sign-out bar — cream footer, ghost-destructive pill.
     ============================================================ */
  signOutBar: {
    backgroundColor: colors.cream,
    borderTopWidth: 1,
    borderTopColor: withAlpha(colors.ink, 0.06),
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14,
  },
  signOutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: withAlpha(colors.danger, 0.06),
    borderWidth: 1,
    borderColor: withAlpha(colors.danger, 0.22),
    borderRadius: 14,
    minHeight: 50,
    overflow: "hidden",
  },
  signOutIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: withAlpha(colors.danger, 0.14),
    alignItems: "center",
    justifyContent: "center",
  },
  signOutText: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: "800",
  },
});