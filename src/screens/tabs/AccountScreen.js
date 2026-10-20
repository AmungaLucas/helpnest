import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
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
import { fetchHistory, requestRefund } from "../../services/paymentsService";
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
  const [history, setHistory] = useState(null);
  const [refundFor, setRefundFor] = useState(null); // txn row awaiting a reason
  const [refundReason, setRefundReason] = useState("");
  const [refundBusy, setRefundBusy] = useState(false);

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

  // Purchase history (PRD §14.7) + refund request action (§14.3 manual
  // flow). Silent failure: the card just stays minimal if the API hiccups.
  const loadHistory = useCallback(() => {
    fetchHistory()
      .then((d) => setHistory(d.history || []))
      .catch(() => setHistory(null));
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  async function submitRefundRequest() {
    if (!refundFor || refundReason.trim().length < 10) return;
    setRefundBusy(true);
    try {
      const d = await requestRefund(refundFor.id, refundReason.trim());
      Alert.alert("Request sent", d.message || "Our team will contact you.");
      setRefundFor(null);
      setRefundReason("");
      loadHistory();
    } catch (e) {
      Alert.alert("Could not send", e.message || "Try again in a minute.");
    } finally {
      setRefundBusy(false);
    }
  }

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
            pendingText={
              user?.email
                ? "Email not verified — tap to verify"
                : "Email verification coming soon"
            }
            action={
              user?.email && !user?.emailVerified
                ? () => navigation.navigate("VerifyEmail", { email: user.email })
                : undefined
            }
          />
          <StatusRow
            ok={user?.kycStatus === "verified"}
            okText="ID verification complete"
            pendingText={`KYC: ${user?.kycStatus || "unverified"}`}
          />
        </View>

        <PurchasesCard
          history={history}
          onRefresh={loadHistory}
          onRequestRefund={(txn) => {
            setRefundFor(txn);
            setRefundReason("");
          }}
        />

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

        {/* Profile boost (PRD §5.1/§18.4) — maids only: 7 days of labeled
            featured placement in employer searches. */}
        {user?.role === "maid" ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Boost your profile</Text>
            <Text style={styles.locationNote}>
              Get a labeled “Featured” placement at the top of employer
              searches for 7 days — KES 100. Placement is labeled, never a
              guaranteed position.
            </Text>
            <Pressable
              accessibilityRole="button"
              style={styles.secondaryButton}
              onPress={() =>
                navigation.navigate("MpesaCheckout", {
                  plan: "profile_boost",
                  label: "Profile boost — 7 days featured",
                })
              }
            >
              <Text style={styles.secondaryButtonText}>
                Boost my profile — KES 100 / 7 days
              </Text>
            </Pressable>
          </View>
        ) : null}

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

      {/* Refund request (PRD §14.7 "Get help") — a short reason is all the
          manual refund workflow needs from the user. */}
      <Modal
        visible={Boolean(refundFor)}
        transparent
        animationType="slide"
        onRequestClose={() => setRefundFor(null)}
      >
        <View style={styles.refundSheetWrap}>
          <Pressable style={styles.refundSheetBackdrop} onPress={() => setRefundFor(null)} />
          <View style={styles.refundSheet}>
            <Text style={styles.refundSheetTitle}>Request a refund</Text>
            {refundFor ? (
              <Text style={styles.refundSheetSub}>
                {refundFor.planLabel || refundFor.plan} · KES {refundFor.amountKes}
              </Text>
            ) : null}
            <Text style={styles.refundSheetHint}>
              Tell us what went wrong (at least 10 characters). Our team
              reviews within 72 hours and refunds are sent to M-Pesa manually.
            </Text>
            <TextInput
              style={styles.refundSheetInput}
              value={refundReason}
              onChangeText={setRefundReason}
              multiline
              numberOfLines={3}
              maxLength={500}
              placeholder="e.g. I paid for the job post but it was never published"
              placeholderTextColor={colors.textFaint}
            />
            <View style={styles.refundSheetActions}>
              <Pressable
                accessibilityRole="button"
                style={[styles.refundSheetBtn, styles.refundSheetBtnGhost]}
                onPress={() => setRefundFor(null)}
                disabled={refundBusy}
              >
                <Text style={styles.refundSheetBtnGhostText}>Cancel</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                style={[
                  styles.refundSheetBtn,
                  (refundBusy || refundReason.trim().length < 10) &&
                    styles.btnDisabled,
                ]}
                onPress={submitRefundRequest}
                disabled={refundBusy || refundReason.trim().length < 10}
              >
                {refundBusy ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Text style={styles.refundSheetBtnText}>Send request</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function StatusRow({ ok, okText, pendingText, action }) {
  const content = (
    <View style={styles.statusRow}>
      <View style={[styles.dot, ok ? styles.dotOk : styles.dotIdle]} />
      <Text
        style={[styles.statusText, action && !ok && styles.statusActionText]}
      >
        {ok ? okText : pendingText}
      </Text>
      {action && !ok ? <Text style={styles.statusActionArrow}>›</Text> : null}
    </View>
  );

  if (action && !ok) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={action}
        hitSlop={6}
      >
        {content}
      </Pressable>
    );
  }

  return content;
}

const REFUND_LABEL = {
  none: null,
  requested: "refund requested",
  approved: "refund approved",
  completed: "refunded",
  rejected: "refund declined",
};

// Purchases & refunds (PRD §14.7): recent payments with their outcome plus
// the per-transaction "Get help" action. Money moves stay manual on our
// side — this card only files and tracks the request.
function PurchasesCard({ history, onRefresh, onRequestRefund }) {
  if (!history || history.length === 0) return null;

  return (
    <View style={styles.card}>
      <View style={styles.refundHead}>
        <Text style={styles.cardTitle}>Purchases & refunds</Text>
        <Pressable onPress={onRefresh} hitSlop={8}>
          <Text style={styles.refundRefresh}>Refresh</Text>
        </Pressable>
      </View>

      {history.slice(0, 8).map((t) => {
        const refundLabel = REFUND_LABEL[t.refundStatus || "none"];
        return (
          <View key={t.id} style={styles.purchaseRow}>
            <View style={styles.purchaseMain}>
              <Text style={styles.purchaseTitle} numberOfLines={1}>
                {t.planLabel || t.plan} · KES {t.amountKes}
              </Text>
              <Text style={styles.purchaseSub} numberOfLines={1}>
                {t.status === "success"
                  ? `Paid · ${t.unitsGranted > 0 ? `${t.unitsGranted} credit${t.unitsGranted === 1 ? "" : "s"}` : "recorded"}`
                  : t.status === "pending"
                    ? "Awaiting payment"
                    : t.status === "timeout"
                      ? "Outcome unknown"
                      : "Payment failed"}
                {refundLabel ? ` · ${refundLabel}` : ""}
              </Text>
            </View>
            {t.status === "success" &&
              (t.refundStatus || "none") === "none" ? (
              <Pressable
                accessibilityRole="button"
                style={styles.refundBtn}
                onPress={() => onRequestRefund(t)}
              >
                <Text style={styles.refundBtnText}>Get help</Text>
              </Pressable>
            ) : null}
          </View>
        );
      })}
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
  statusActionText: {
    color: colors.brand,
    fontWeight: "700",
    textDecorationLine: "underline",
  },
  statusActionArrow: {
    color: colors.brand,
    fontSize: 18,
    fontWeight: "700",
    marginLeft: "auto",
  },
  refundHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  refundRefresh: {
    color: colors.brand,
    fontSize: 12,
    fontWeight: "700",
  },
  purchaseRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.mist,
  },
  purchaseMain: { flex: 1, marginRight: 8 },
  purchaseTitle: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "700",
  },
  purchaseSub: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  refundBtn: {
    borderWidth: 1,
    borderColor: colors.mistDark,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.white,
  },
  refundBtnText: {
    color: colors.brand,
    fontSize: 11,
    fontWeight: "800",
  },
  refundSheetWrap: { flex: 1, justifyContent: "flex-end" },
  refundSheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(38, 49, 43, 0.45)",
  },
  refundSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 20,
    paddingBottom: 30,
  },
  refundSheetTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: "800",
  },
  refundSheetSub: {
    color: colors.brand,
    fontSize: 13,
    fontWeight: "700",
    marginTop: 4,
  },
  refundSheetHint: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 8,
    marginBottom: 12,
  },
  refundSheetInput: {
    borderWidth: 1,
    borderColor: colors.mistDark,
    borderRadius: 12,
    backgroundColor: colors.cream,
    padding: 12,
    minHeight: 84,
    textAlignVertical: "top",
    color: colors.ink,
    fontSize: 14,
  },
  refundSheetActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 14,
  },
  refundSheetBtn: {
    backgroundColor: colors.brand,
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
    minWidth: 110,
    alignItems: "center",
  },
  refundSheetBtnText: { color: colors.white, fontWeight: "800", fontSize: 14 },
  refundSheetBtnGhost: { backgroundColor: colors.mist },
  refundSheetBtnGhostText: { color: colors.ink, fontWeight: "700", fontSize: 14 },
  btnDisabled: { opacity: 0.45 },
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
