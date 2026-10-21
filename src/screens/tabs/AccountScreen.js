import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";

import { useAuth } from "../../context/AuthContext";
import { logout } from "../../services/authService";
import { updateMe } from "../../services/usersService";
import { uploadMedia } from "../../services/mediaService";
import { fetchHistory, requestRefund } from "../../services/paymentsService";
import { fetchNotifications } from "../../services/notificationsService";
import SignedImage from "../../components/media/SignedImage";
import {
  openAppSettings,
  requestAndFetchLocation,
} from "../../utils/location";
import HamburgerButton from "../../components/ui/HamburgerButton";
import TabBarIcon from "../../components/ui/TabBarIcon";
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
  const [history, setHistory] = useState(null);
  const [refundFor, setRefundFor] = useState(null); // txn row awaiting a reason
  const [refundReason, setRefundReason] = useState("");
  const [refundBusy, setRefundBusy] = useState(false);
  const [unread, setUnread] = useState(0);

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

  const firstName = (user?.name || "").split(" ")[0] || "?";
  const hasCoords = user?.locationLat !== null && user?.locationLat !== undefined;

  // The full verification & safety surface lives one tap away — the drawer
  // route name differs per role (maid: "Kyc", employer: "Verification").
  const verificationRoute = user?.role === "maid" ? "Kyc" : "Verification";

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

      {/* Sticky header — always visible: hamburger toggles the profile
          drawer, bell opens Notifications with the unread badge. */}
      <View style={styles.topBar}>
        <HamburgerButton />
        <View style={styles.topBarMain} pointerEvents="none">
          <Text style={styles.topBarTitle}>Profile</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            unread > 0 ? `Notifications, ${unread} unread` : "Notifications"
          }
          onPress={() => navigation.navigate("Notifications")}
          hitSlop={6}
          style={({ pressed }) => [styles.bellBtn, pressed && styles.pressed]}
          android_ripple={{ color: withAlpha(colors.brand, 0.1), radius: 22 }}
        >
          <TabBarIcon name="bell" color={colors.ink} size={20} />
          {unread > 0 ? (
            <View style={styles.bellBadge}>
              <Text style={styles.bellBadgeText}>
                {unread > 99 ? "99+" : unread}
              </Text>
            </View>
          ) : null}
        </Pressable>
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

        {/* Account & verification (§4.2) — phone / email / ID channel
            statuses; trust & safety tooling lives behind the footer link
            and in the drawer's verification screen. */}
        <View style={[styles.card, CARD_SHADOW]}>
          <View style={styles.headRow}>
            <View style={styles.headIcon}>
              <TabBarIcon name="shield-check" color={colors.brand} size={20} />
            </View>
            <View style={styles.headMain}>
              <Text style={styles.eyebrow}>Trust & safety</Text>
              <Text style={styles.cardTitle}>Account & verification</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => navigation.navigate(verificationRoute)}
              hitSlop={8}
              style={({ pressed }) => [
                styles.refreshBtn,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.cardLink}>Manage</Text>
            </Pressable>
          </View>

          <View style={styles.statusList}>
            <StatusRow
              ok={user?.phoneVerified}
              okText="Phone verified"
              pendingText="Phone not verified yet"
            />
            <StatusRow
              divided
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
              divided
              ok={user?.kycStatus === "verified"}
              okText="ID verification complete"
              pendingText={`KYC: ${user?.kycStatus || "unverified"}`}
            />
          </View>
        </View>

        {/* Subscription & payments (§14) — M-Pesa purchases, refunds and
            the STK-push self-test, merged into one billing surface. */}
        <View style={[styles.card, CARD_SHADOW]}>
          <View style={styles.headRow}>
            <View style={styles.headIcon}>
              <TabBarIcon name="credit-card" color={colors.brand} size={20} />
            </View>
            <View style={styles.headMain}>
              <Text style={styles.eyebrow}>Billing</Text>
              <Text style={styles.cardTitle}>Subscription & payments</Text>
            </View>
            {history && history.length > 0 ? (
              <Pressable
                onPress={loadHistory}
                hitSlop={8}
                style={({ pressed }) => [
                  styles.refreshBtn,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.refundRefresh}>Refresh</Text>
              </Pressable>
            ) : null}
          </View>

          {history && history.length > 0 ? (
            history.slice(0, 8).map((t, tIndex) => (
              <PurchaseRow
                key={t.id}
                txn={t}
                first={tIndex === 0}
                onRequestRefund={(txn) => {
                  setRefundFor(txn);
                  setRefundReason("");
                }}
              />
            ))
          ) : (
            <Text style={styles.locationNote}>
              Your M-Pesa purchases and receipts will be listed here. All
              payments go through STK push — you approve on your phone.
            </Text>
          )}

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

        {/* Profile boost (PRD §5.1/§18.4) — maids only: 7 days of labeled
            featured placement in employer searches. */}
        {user?.role === "maid" ? (
          <View style={[styles.card, CARD_SHADOW]}>
            <View style={styles.headRow}>
              <View style={[styles.headIcon, styles.headIconGold]}>
                <TabBarIcon name="zap" color={colors.goldDark} size={20} />
              </View>
              <View style={styles.headMain}>
                <Text style={styles.eyebrow}>Featured</Text>
                <Text style={styles.cardTitle}>Boost your profile</Text>
              </View>
            </View>
            <Text style={styles.locationNote}>
              Get a labeled “Featured” placement at the top of employer
              searches for 7 days — KES 100. Placement is labeled, never a
              guaranteed position.
            </Text>
            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.secondaryButton,
                pressed && styles.pressed,
              ]}
              onPress={() =>
                navigation.navigate("MpesaCheckout", {
                  plan: "profile_boost",
                  label: "Profile boost — 7 days featured",
                })
              }
              android_ripple={{ color: withAlpha(colors.brand, 0.08) }}
            >
              <Text style={styles.secondaryButtonText}>
                Boost my profile — KES 100 / 7 days
              </Text>
            </Pressable>
          </View>
        ) : null}

        {/* Referrals moved to the profile drawer (Invite friends). */}

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
          <TabBarIcon name="user-x" color={colors.danger} size={17} />
          <Text style={styles.signOutText}>
            {signingOut ? "Signing out…" : "Sign out"}
          </Text>
        </Pressable>
      </View>

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
            <View style={styles.refundGrabber} />
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
                style={({ pressed }) => [
                  styles.refundSheetBtn,
                  styles.refundSheetBtnGhost,
                  pressed && styles.pressed,
                ]}
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

function StatusRow({ ok, okText, pendingText, action, divided }) {
  const content = (
    <View style={[styles.statusRow, divided && styles.statusRowDivided]}>
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
        style={({ pressed }) => pressed && styles.pressed}
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

// One purchase row (PRD §14.7): outcome line + per-transaction "Get help"
// while the payment can still be refunded. Money moves stay manual on our
// side — this row only files and tracks the request.
function PurchaseRow({ txn, onRequestRefund, first }) {
  const refundLabel = REFUND_LABEL[txn.refundStatus || "none"];

  return (
    <View style={[styles.purchaseRow, !first && styles.purchaseRowDivided]}>
      <View style={styles.purchaseMain}>
        <Text style={styles.purchaseTitle} numberOfLines={1}>
          {txn.planLabel || txn.plan} · KES {txn.amountKes}
        </Text>
        <Text style={styles.purchaseSub} numberOfLines={1}>
          {txn.status === "success"
            ? `Paid · ${txn.unitsGranted > 0 ? `${txn.unitsGranted} credit${txn.unitsGranted === 1 ? "" : "s"}` : "recorded"}`
            : txn.status === "pending"
              ? "Awaiting payment"
              : txn.status === "timeout"
                ? "Outcome unknown"
                : "Payment failed"}
          {refundLabel ? ` · ${refundLabel}` : ""}
        </Text>
      </View>
      {txn.status === "success" && (txn.refundStatus || "none") === "none" ? (
        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.refundBtn,
            pressed && styles.pressed,
          ]}
          onPress={() => onRequestRefund(txn)}
          android_ripple={{ color: withAlpha(colors.brand, 0.08) }}
        >
          <Text style={styles.refundBtnText}>Get help</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 32,
  },
  pressed: {
    opacity: 0.88,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingTop: 6,
    paddingBottom: 8,
  },
  topBarMain: {
    flex: 1,
    marginHorizontal: 10,
  },
  topBarTitle: {
    color: colors.ink,
    fontSize: 23,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  bellBtn: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.mist,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  bellBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.gold,
    borderWidth: 2,
    borderColor: colors.cream,
    paddingHorizontal: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  bellBadgeText: {
    color: colors.white,
    fontSize: 9,
    fontWeight: "800",
  },
  cardLink: {
    color: colors.brand,
    fontSize: 12,
    fontWeight: "800",
  },
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
  },
  avatarWrap: {
    marginRight: 16,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 18,
    backgroundColor: withAlpha(colors.brand, 0.14),
    alignItems: "center",
    justifyContent: "center",
    ...CARD_SHADOW,
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
    marginBottom: 22,
  },
  cardTappable: {
    overflow: "hidden",
  },
  headRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
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
  headIconGold: {
    backgroundColor: withAlpha(colors.gold, 0.18),
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
  statusList: {
    backgroundColor: colors.cream,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.mist,
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 46,
    paddingVertical: 6,
  },
  statusRowDivided: {
    borderTopWidth: 1,
    borderTopColor: colors.mist,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 12,
  },
  dotOk: {
    backgroundColor: colors.brandSoft,
  },
  dotIdle: {
    backgroundColor: colors.gold,
  },
  statusText: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
    flex: 1,
  },
  statusActionText: {
    color: colors.brand,
    fontWeight: "700",
    textDecorationLine: "underline",
  },
  statusActionArrow: {
    color: colors.textFaint,
    fontSize: 20,
    fontWeight: "700",
    marginLeft: 8,
  },
  refreshBtn: {
    backgroundColor: withAlpha(colors.brand, 0.08),
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 7,
    overflow: "hidden",
  },
  refundRefresh: {
    color: colors.brand,
    fontSize: 12,
    fontWeight: "800",
  },
  purchaseRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 56,
    paddingVertical: 10,
  },
  purchaseRowDivided: {
    borderTopWidth: 1,
    borderTopColor: colors.mist,
  },
  purchaseMain: {
    flex: 1,
    marginRight: 10,
  },
  purchaseTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "700",
  },
  purchaseSub: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 3,
  },
  refundBtn: {
    backgroundColor: withAlpha(colors.gold, 0.16),
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    overflow: "hidden",
  },
  refundBtnText: {
    color: colors.goldDark,
    fontSize: 11.5,
    fontWeight: "800",
  },
  refundSheetWrap: {
    flex: 1,
    justifyContent: "flex-end",
  },
  refundSheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: withAlpha(colors.ink, 0.45),
  },
  refundSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    padding: 24,
    paddingBottom: 40,
  },
  refundGrabber: {
    alignSelf: "center",
    width: 44,
    height: 4,
    borderRadius: 999,
    backgroundColor: colors.cloud,
    marginBottom: 14,
  },
  refundSheetTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  refundSheetSub: {
    color: colors.brand,
    fontSize: 13.5,
    fontWeight: "700",
    marginTop: 4,
  },
  refundSheetHint: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 8,
    marginBottom: 14,
  },
  refundSheetInput: {
    borderWidth: 1,
    borderColor: colors.mistDark,
    borderRadius: 16,
    backgroundColor: colors.cream,
    padding: 14,
    minHeight: 96,
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
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingVertical: 13,
    minHeight: 48,
    minWidth: 110,
    alignItems: "center",
    justifyContent: "center",
  },
  refundSheetBtnText: {
    color: colors.white,
    fontWeight: "800",
    fontSize: 14,
  },
  refundSheetBtnGhost: {
    backgroundColor: colors.mist,
  },
  refundSheetBtnGhostText: {
    color: colors.ink,
    fontWeight: "700",
    fontSize: 14,
  },
  btnDisabled: {
    opacity: 0.45,
  },
  locationLine: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 6,
  },
  locationNote: {
    color: colors.textMuted,
    fontSize: 13.5,
    lineHeight: 20,
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
