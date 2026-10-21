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

// Soft card lift shared by every white surface on the cream canvas.
const CARD_SHADOW = {
  shadowColor: colors.ink,
  shadowOpacity: 0.06,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 5 },
  elevation: 1,
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
      Alert.alert("Could not update", error?.message || "Please try again in a moment.");
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
              captureId: registerCaptureCallback((uri) => uploadProfilePhoto(uri)),
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
        Alert.alert(
          "Location permission needed",
          error.message,
          [
            { text: "Not now", style: "cancel" },
            ...(error.canAskAgain
              ? []
              : [{ text: "Open settings", onPress: () => openAppSettings() }]),
          ]
        );
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
        {/* Identity header — avatar squircle, name, role + verified pills. */}
        <View style={styles.profileRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Change profile photo"
            style={({ pressed }) => [styles.avatarWrap, pressed && styles.pressed]}
            onPress={chooseProfileSource}
            disabled={uploadingPhoto}
          >
            {/* Elevation lives on this opaque wrapper — Android renders the
                elevation shadow THROUGH translucent fills (dark silhouette =
                the "black overlay" over the photo), so the tinted avatar
                itself must stay elevation-free. */}
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
          <View style={styles.profileMain}>
            <Text style={styles.name} numberOfLines={1}>
              {user?.name}
            </Text>
            <Text style={styles.roleLine}>
              {ROLE_LABELS[user?.role] || user?.role || "Member"} ·{" "}
              {user?.phone}
            </Text>
            {verifiedChips.length > 0 ? (
              <View style={styles.chipRow}>
                {verifiedChips.map((chip) => (
                  <View key={chip} style={styles.verifiedChip}>
                    <TabBarIcon name="check" color={colors.brand} size={11} />
                    <Text style={styles.verifiedChipText}>{chip}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        </View>

        {/* Notifications (§17) — feed of verification, payment, application
            and account events. Badge shows the unread count. */}
        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.card,
            CARD_SHADOW,
            styles.cardTappable,
            pressed && styles.pressed,
          ]}
          onPress={() => navigation.navigate("Notifications")}
          android_ripple={{ color: withAlpha(colors.brand, 0.08) }}
        >
          <View style={styles.notifRow}>
            <View style={styles.menuIcon}>
              <TabBarIcon name="bell" color={colors.brand} size={20} />
            </View>
            <View style={styles.menuMain}>
              <Text style={styles.menuTitle}>Notifications</Text>
              <Text style={styles.menuNote}>
                {unread > 0
                  ? `${unread} unread update${unread === 1 ? "" : "s"} — verification, payments and applications.`
                  : "Verification, payments and account updates land here."}
              </Text>
            </View>
            {unread > 0 ? (
              <View style={styles.notifBadge}>
                <Text style={styles.notifBadgeText}>
                  {unread > 99 ? "99+" : unread}
                </Text>
              </View>
            ) : null}
            <Text style={styles.menuChevron}>›</Text>
          </View>
        </Pressable>

        {/* §17.2 — email preference. Only meaningful with an email on file. */}
        {user?.email ? (
          <View style={[styles.card, CARD_SHADOW]}>
            <View style={styles.notifRow}>
              <View style={styles.menuIcon}>
                {/* "mail" isn't in the TabBarIcon set — "send" carries the
                    email-fanout semantics on the approved icon list. */}
                <TabBarIcon name="send" color={colors.brand} size={20} />
              </View>
              <View style={styles.menuMain}>
                <Text style={styles.menuTitle}>Email updates</Text>
                <Text style={styles.menuNote} numberOfLines={2}>
                  Application, job and promotion emails. Security notices
                  always come through.
                </Text>
              </View>
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
        ) : null}

        <View style={[styles.card, CARD_SHADOW]}>
          <View style={styles.headRow}>
            <View style={styles.headIcon}>
              <TabBarIcon name="map-pin" color={colors.brand} size={20} />
            </View>
            <View style={styles.headMain}>
              <Text style={styles.eyebrow}>Your area</Text>
              <Text style={styles.cardTitle}>Location</Text>
            </View>
          </View>

          {hasCoords ? (
            <>
              <Text style={styles.locationLine}>
                {user?.locationLabel
                  ? `${user.locationLabel} · `
                  : ""}
                {Number(user.locationLat).toFixed(4)},{" "}
                {Number(user.locationLng).toFixed(4)}
              </Text>
              <Text style={styles.locationNote}>
                Used to show you nearby workers and jobs — never your exact
                address.
              </Text>
            </>
          ) : (
            <Text style={styles.locationNote}>
              Add your general location so we can match you with work and
              workers nearby. Your exact address is never shared.
            </Text>
          )}

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

        {/* Profile boost (PRD §5.1/§18.4) now lives on the maid HOME screen
            as a Featured promo card — moved there 2026-10-21 for relevance. */}

        <View style={[styles.card, CARD_SHADOW]}>
          <View style={styles.headRow}>
            <View style={styles.headIcon}>
              <TabBarIcon name="credit-card" color={colors.brand} size={20} />
            </View>
            <View style={styles.headMain}>
              <Text style={styles.eyebrow}>M-Pesa</Text>
              <Text style={styles.cardTitle}>Payments</Text>
            </View>
          </View>
          <Text style={styles.locationNote}>
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
            <Text style={styles.secondaryButtonText}>Try a KES 1 test payment</Text>
          </Pressable>
        </View>

        <Text style={styles.versionText}>HelpNest v1.0.0</Text>
      </ScrollView>

      {/* Sticky sign-out bar — the screen's single primary action, kept
          anchored above the tab bar. */}
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
          <TabBarIcon name="user-x" color={colors.danger} size={16} />
          <Text style={styles.signOutText}>
            {signingOut ? "Signing out…" : "Sign out"}
          </Text>
        </Pressable>
      </View>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 4,
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
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
  },
  avatarWrap: {
    marginRight: 16,
  },
  // Opaque shadow carrier. elevation over a withAlpha() fill makes Android
  // draw the silhouette through the fill (dark blob) and skews border
  // rendering — same wrapper/inner split as the Subscription plan cards.
  avatarShadow: {
    borderRadius: 18,
    backgroundColor: colors.white,
    alignSelf: "flex-start",
    ...CARD_SHADOW,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 18,
    backgroundColor: withAlpha(colors.brand, 0.14),
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarBadge: {
    position: "absolute",
    right: -3,
    bottom: -3,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.brand,
    borderWidth: 2.5,
    borderColor: colors.cream,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: colors.brand,
    fontSize: 26,
    fontWeight: "800",
  },
  profileMain: {
    flex: 1,
  },
  name: {
    color: colors.ink,
    fontSize: 23,
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
    gap: 5,
    backgroundColor: withAlpha(colors.brand, 0.1),
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  verifiedChipText: {
    color: colors.brand,
    fontSize: 11,
    fontWeight: "800",
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.mist,
    padding: 20,
    marginBottom: 24,
  },
  cardTappable: {
    overflow: "hidden",
  },
  headRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  headIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: withAlpha(colors.brand, 0.1),
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  headMain: {
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
  cardTitle: {
    color: colors.ink,
    fontSize: 17.5,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  notifRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  menuIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: withAlpha(colors.brand, 0.1),
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  menuMain: {
    flex: 1,
    marginRight: 10,
  },
  menuTitle: {
    color: colors.ink,
    fontSize: 15.5,
    fontWeight: "700",
  },
  menuNote: {
    color: colors.textMuted,
    fontSize: 12.5,
    lineHeight: 17,
    fontWeight: "600",
    marginTop: 2,
  },
  menuChevron: {
    color: colors.textFaint,
    fontSize: 22,
    fontWeight: "700",
    marginLeft: 4,
  },
  notifBadge: {
    backgroundColor: colors.gold,
    borderRadius: 999,
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 6,
  },
  notifBadgeText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: "800",
  },
  locationLine: {
    color: colors.ink,
    fontSize: 13.5,
    fontWeight: "700",
    marginBottom: 6,
  },
  locationNote: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 14,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: colors.brand,
    borderRadius: 16,
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    overflow: "hidden",
  },
  secondaryButtonText: {
    color: colors.brand,
    fontSize: 14,
    fontWeight: "800",
  },
  signOutBar: {
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.mist,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  signOutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: 16,
    minHeight: 54,
    overflow: "hidden",
  },
  signOutText: {
    color: colors.danger,
    fontSize: 15,
    fontWeight: "800",
  },
  versionText: {
    color: colors.textFaint,
    fontSize: 11.5,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 2,
  },
});
