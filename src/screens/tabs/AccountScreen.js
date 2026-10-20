import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";

import { useAuth } from "../../context/AuthContext";
import { logout } from "../../services/authService";
import { updateMe } from "../../services/usersService";
import { uploadMedia } from "../../services/mediaService";
import { getMyReferrals } from "../../services/referralsService";
import SignedImage from "../../components/media/SignedImage";
import {
  openAppSettings,
  requestAndFetchLocation,
} from "../../utils/location";
import HamburgerButton from "../../components/ui/HamburgerButton";
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
  const [referral, setReferral] = useState(null);
  const [referralLoading, setReferralLoading] = useState(true);

  // Referral programme summary — invite code, reward rules, earnings.
  // Silent failure: the card just doesn't render if the API hiccups.
  const loadReferral = useCallback(() => {
    setReferralLoading(true);
    getMyReferrals()
      .then(setReferral)
      .catch(() => setReferral(null))
      .finally(() => setReferralLoading(false));
  }, []);

  useEffect(() => {
    loadReferral();
  }, [loadReferral]);

  async function shareInvite() {
    if (!referral?.code) return;
    try {
      await Share.share({
        message:
          referral.shareText ||
          `Join me on HelpNest — use my code ${referral.code} when you sign up!`,
      });
    } catch (error) {
      // User dismissed the share sheet — nothing to do.
    }
  }

  const firstName = (user?.name || "").split(" ")[0] || "?";
  const hasCoords = user?.locationLat !== null && user?.locationLat !== undefined;

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
        onUse: (uri) => uploadProfilePhoto(uri),
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
              onCaptured: (uri) => uploadProfilePhoto(uri),
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

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.menuRow}>
          <HamburgerButton />
        </View>

        <View style={styles.profileRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Change profile photo"
            style={styles.avatarWrap}
            onPress={chooseProfileSource}
            disabled={uploadingPhoto}
          >
            <SignedImage
              mediaId={user?.profileMediaId}
              variant="thumb"
              fallbackText={firstName}
              style={styles.avatar}
              textStyle={styles.avatarText}
            />
            <View style={styles.avatarBadge}>
              {uploadingPhoto ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Text style={styles.avatarBadgeText}>Edit</Text>
              )}
            </View>
          </Pressable>
          <View style={styles.profileMain}>
            <Text style={styles.name}>{user?.name}</Text>
            <Text style={styles.roleLine}>
              {ROLE_LABELS[user?.role] || user?.role || "Member"} ·{" "}
              {user?.phone}
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Verification</Text>

          <StatusRow
            ok={user?.phoneVerified}
            okText="Phone verified"
            pendingText="Phone not verified yet"
          />
          <StatusRow
            ok={user?.emailVerified}
            okText="Email verified"
            pendingText="Email verification coming soon"
          />
          <StatusRow
            ok={user?.kycStatus === "verified"}
            okText="ID verification complete"
            pendingText={`KYC: ${user?.kycStatus || "unverified"}`}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Location</Text>

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
            style={styles.secondaryButton}
            onPress={handleUseLocation}
            disabled={locating}
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

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Payments</Text>
          <Text style={styles.locationNote}>
            M-Pesa is wired up. Try a KES 1 test payment to confirm STK push
            works on your phone before real pricing goes live.
          </Text>
          <Pressable
            accessibilityRole="button"
            style={styles.secondaryButton}
            onPress={() =>
              navigation.navigate("MpesaCheckout", {
                plan: "test_kes1",
                label: "M-Pesa test payment",
              })
            }
          >
            <Text style={styles.secondaryButtonText}>Try a KES 1 test payment</Text>
          </Pressable>
        </View>

        {/* Referral programme — earn cash when friends you invite pay. */}
        {!referralLoading && referral?.code ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Earn with referrals</Text>
            <Text style={styles.locationNote}>{referral.rewardText}</Text>

            <View style={styles.referralCodeRow}>
              <Text style={styles.referralCode}>{referral.code}</Text>
              <Pressable
                accessibilityRole="button"
                style={styles.shareButton}
                onPress={shareInvite}
              >
                <Text style={styles.shareButtonText}>Share code</Text>
              </Pressable>
            </View>

            <View style={styles.referralStatsRow}>
              <ReferralStat
                value={referral.stats?.invited || 0}
                label="invited"
              />
              <ReferralStat
                value={referral.stats?.qualified || 0}
                label="paid"
              />
              <ReferralStat
                value={`KES ${Number(referral.stats?.earnedKes || 0).toLocaleString("en-KE")}`}
                label="earned"
                strong
              />
            </View>

            {Number(referral.stats?.pendingKes || 0) > 0 && (
              <Text style={styles.referralPending}>
                KES {Number(referral.stats.pendingKes).toLocaleString("en-KE")} on
                the way — payouts go out to M-Pesa once your balance reaches
                KES {Number(referral.minPayoutKes || 0).toLocaleString("en-KE")}.
              </Text>
            )}
          </View>
        ) : null}

        <Pressable
          accessibilityRole="button"
          style={styles.signOutButton}
          onPress={confirmSignOut}
          disabled={signingOut}
        >
          <Text style={styles.signOutText}>
            {signingOut ? "Signing out…" : "Sign out"}
          </Text>
        </Pressable>

        <Text style={styles.versionText}>HelpNest v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatusRow({ ok, okText, pendingText }) {
  return (
    <View style={styles.statusRow}>
      <View style={[styles.dot, ok ? styles.dotOk : styles.dotIdle]} />
      <Text style={styles.statusText}>{ok ? okText : pendingText}</Text>
    </View>
  );
}

function ReferralStat({ value, label, strong }) {
  return (
    <View style={styles.referralStat}>
      <Text
        style={[
          styles.referralStatValue,
          strong && styles.referralStatValueStrong,
        ]}
      >
        {value}
      </Text>
      <Text style={styles.referralStatLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  scroll: {
    padding: 22,
    paddingBottom: 60,
  },
  menuRow: {
    marginBottom: 12,
  },
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  avatarWrap: {
    marginRight: 14,
  },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 19,
    backgroundColor: withAlpha(colors.brand, 0.14),
    alignItems: "center",
    justifyContent: "center",
  },
  avatarBadge: {
    position: "absolute",
    right: -4,
    bottom: -4,
    backgroundColor: colors.brand,
    borderRadius: 9,
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderWidth: 2,
    borderColor: colors.cream,
  },
  avatarBadgeText: {
    color: colors.white,
    fontSize: 9.5,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  avatarText: {
    color: colors.brand,
    fontSize: 24,
    fontWeight: "800",
  },
  profileMain: {
    flex: 1,
  },
  name: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: "800",
  },
  roleLine: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "600",
    marginTop: 2,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.mist,
    padding: 16,
    marginBottom: 14,
  },
  cardTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 10,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 5,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 9,
  },
  dotOk: {
    backgroundColor: colors.brandSoft,
  },
  dotIdle: {
    backgroundColor: colors.gold,
  },
  statusText: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "600",
  },
  locationLine: {
    color: colors.ink,
    fontSize: 13.5,
    fontWeight: "700",
    marginBottom: 6,
  },
  locationNote: {
    color: colors.textMuted,
    fontSize: 12.5,
    lineHeight: 19,
    marginBottom: 12,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: colors.brand,
    borderRadius: 12,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  secondaryButtonText: {
    color: colors.brand,
    fontSize: 13.5,
    fontWeight: "800",
  },
  signOutButton: {
    borderWidth: 1,
    borderColor: "#C24136",
    borderRadius: 14,
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
  },
  referralCodeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: withAlpha(colors.brand, 0.08),
    borderRadius: 14,
    borderWidth: 1,
    borderColor: withAlpha(colors.brand, 0.25),
    padding: 12,
    marginBottom: 12,
  },
  referralCode: {
    color: colors.brand,
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: 2.5,
  },
  shareButton: {
    backgroundColor: colors.brand,
    borderRadius: 11,
    minHeight: 42,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  shareButtonText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: "800",
  },
  referralStatsRow: {
    flexDirection: "row",
    marginBottom: 4,
  },
  referralStat: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 4,
  },
  referralStatValue: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "800",
  },
  referralStatValueStrong: {
    color: colors.brand,
  },
  referralStatLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "600",
    marginTop: 2,
  },
  referralPending: {
    color: colors.goldDark,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "600",
    marginTop: 6,
  },
  signOutText: {
    color: "#C24136",
    fontSize: 14.5,
    fontWeight: "800",
  },
  versionText: {
    color: colors.textFaint,
    fontSize: 11.5,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 18,
  },
});
