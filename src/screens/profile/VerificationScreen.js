import React, { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  RefreshControl,
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

import PrimaryButton from "../../components/ui/PrimaryButton";
import ScreenHeader from "../../components/ui/ScreenHeader";
import TabBarIcon from "../../components/ui/TabBarIcon";
import EmptyState from "../../components/ui/EmptyState";
import { useAuth } from "../../context/AuthContext";
import { uploadMedia } from "../../services/mediaService";
import { getKycStatus, submitKyc } from "../../services/kycService";
import { fileAppeal } from "../../services/appealsService";
import { registerCaptureCallback } from "../../utils/captureCallback";
import { colors, withAlpha } from "../../theme/colors";

// KYC verification flow (PRD §4.2, §10.2, BUILD-PLAN W2-F3).
//
// Both roles use this screen — the copy adapts via `roleCopy`. The flow is:
//   status view (default) -> form view (ID front / ID back / selfie) ->
//   DPA 2019 consent -> submit -> back to status view ("under review").
//
// 2026-10-20 round of fixes:
//   - The status view silently polls /api/kyc/status every 12s whenever a
//     decision can still land — review in flight, or any document flagged/
//     awaiting. Approvals AND late un-rejections appear on their own; only
//     settled states (verified / unverified / suspended) stop the watch.
//   - Rejection reasons from the reviewer render per document row.
//   - After a PARTIAL rejection (e.g. selfie approved, ID back rejected) the
//     resubmit form only asks for the rejected docs — approved ones render as
//     locked rows and are NOT re-uploaded (server accepts the subset).
//   - Gallery picks pass through ImageReview before anything uploads, so the
//     user always decides what leaves the phone.

const SLOTS = [
  {
    key: "id_front",
    label: "ID — front side",
    hint: "National ID front on a flat surface, all corners visible, no glare.",
  },
  {
    key: "id_back",
    label: "ID — back side",
    hint: "Flip it over. The serial number and date of issue must be readable.",
  },
  {
    key: "selfie",
    label: "Selfie with today's face",
    hint: "Plain background, good light, no sunglasses or hat. Just you.",
  },
];

// How often the status view re-checks while a submission is under review.
const POLL_MS = 12000;

const STATUS_THEMES = {
  verified: {
    bg: withAlpha(colors.brand, 0.08),
    border: withAlpha(colors.brand, 0.22),
    text: colors.brand,
  },
  pending: {
    bg: withAlpha(colors.gold, 0.14),
    border: withAlpha(colors.gold, 0.38),
    text: colors.goldDark,
  },
  rejected: {
    bg: withAlpha(colors.danger, 0.07),
    border: withAlpha(colors.danger, 0.22),
    text: colors.danger,
  },
  unverified: { bg: colors.mist, border: colors.mistDark, text: colors.ink },
};

const DOC_STATUS_LABELS = {
  pending: "Awaiting review",
  approved: "Approved",
  rejected: "Needs retake",
};

const ROLE_COPY = {
  maid: {
    screenTitle: "Account & verification",
    intro:
      "A verified badge makes employers trust your profile instantly — verified workers get messaged first.",
    verifiedBlurb:
      "Your badge is now live on your profile. Employers see it everywhere your name appears.",
  },
  employer: {
    screenTitle: "Account & verification",
    intro:
      "Verified households get faster responses — workers know a real, checked family is behind the request.",
    verifiedBlurb:
      "Your household is verified. Workers will see the trusted badge when you contact them.",
  },
};

function DocSlot({ label, hint, state, onPick, disabled }) {
  const uploaded = Boolean(state?.mediaId);

  return (
    <View style={styles.slot}>
      <Pressable
        accessibilityRole="button"
        onPress={onPick}
        disabled={disabled}
        style={({ pressed }) => [styles.slotPress, pressed && styles.pressed]}
      >
        {state?.uri ? (
          <View>
            <Image source={{ uri: state.uri }} style={styles.slotThumb} />
            <View
              style={[
                styles.slotPill,
                uploaded && styles.slotPillOk,
                state.error && styles.slotPillError,
              ]}
            >
              {state.uploading ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : uploaded ? (
                <TabBarIcon name="check" color={colors.white} size={13} />
              ) : (
                <TabBarIcon name="x" color={colors.white} size={13} />
              )}
            </View>
          </View>
        ) : (
          <View style={styles.slotEmpty}>
            <Text style={styles.slotPlus}>+</Text>
          </View>
        )}
      </Pressable>
      <View style={styles.slotCopy}>
        <Text style={styles.slotLabel}>{label}</Text>
        <Text
          style={[
            styles.slotHint,
            state?.error ? styles.slotHintError : null,
          ]}
        >
          {state?.error ? state.error : hint}
        </Text>
      </View>
    </View>
  );
}

// Approved documents during a resubmission — shown but not editable, so the
// reviewer's decision is respected and the user never re-uploads needlessly.
function LockedApprovedSlot({ label }) {
  return (
    <View style={[styles.slot, styles.slotLocked]}>
      <View style={[styles.slotPress, styles.slotLockedThumb]}>
        <TabBarIcon name="check" color={colors.white} size={22} />
      </View>
      <View style={styles.slotCopy}>
        <Text style={styles.slotLabel}>{label}</Text>
        <Text style={[styles.slotHint, styles.slotLockedHint]}>
          Approved — passed review. No need to retake this one.
        </Text>
      </View>
    </View>
  );
}

export default function VerificationScreen() {
  const { user } = useAuth();
  const navigation = useNavigation();
  const roleCopy = ROLE_COPY[user?.role] || ROLE_COPY.employer;

  const [loading, setLoading] = useState(true);
  const [statusData, setStatusData] = useState(null);
  const [appealOpen, setAppealOpen] = useState(false);
  const [appealMsg, setAppealMsg] = useState("");
  const [appealBusy, setAppealBusy] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [mode, setMode] = useState("status"); // "status" | "form"

  const [docs, setDocs] = useState({
    id_front: null,
    id_back: null,
    selfie: null,
  });
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  // Poll gate: the interval always runs while focused, but only fires a
  // request while a decision can still land behind the user's back. With
  // document-derived status, "rejected" is NOT final — the reviewer can
  // flip a flagged row to approved later, and the screen must show it
  // without a navigate-away dance. Only settled states stop the watch.
  const kycPollRef = useRef(false);

  const applyStatus = useCallback((data) => {
    const raw = data?.kycStatus || "unverified";
    const docs = data?.documents || {};
    const anyDocPending = SLOTS.some((s) => docs[s.key]?.status === "pending");

    kycPollRef.current =
      raw === "pending" || raw === "rejected" || anyDocPending;

    setStatusData(data);
  }, []);

  const refresh = useCallback(
    async ({ silent = false } = {}) => {
      if (!silent) setLoadError("");

      try {
        const data = await getKycStatus();
        applyStatus(data);
      } catch (err) {
        if (!silent) {
          setLoadError(
            err?.message || "Could not load your verification status."
          );
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [applyStatus]
  );

  useFocusEffect(
    useCallback(() => {
      refresh();

      // Auto-update: an approval/rejection lands on this screen without the
      // user having to leave and come back. Cleared on blur.
      const timer = setInterval(() => {
        if (kycPollRef.current) {
          refresh({ silent: true });
        }
      }, POLL_MS);

      return () => clearInterval(timer);
    }, [refresh])
  );

  // Shared tail of both capture paths (guided camera + gallery): stage the
  // local photo, upload immediately, surface a per-slot retry pill on error.
  async function handleCaptured(slotKey, mediaKind, uri) {
    setDocs((prev) => ({
      ...prev,
      [slotKey]: { uri, mediaId: null, uploading: true, error: "" },
    }));

    try {
      const response = await uploadMedia({ uri, kind: mediaKind });
      const mediaId = response?.media?.id;

      if (!mediaId) {
        throw new Error("Upload response was missing the document id.");
      }

      setDocs((prev) => ({
        ...prev,
        [slotKey]: { uri, mediaId, uploading: false, error: "" },
      }));
    } catch (err) {
      setDocs((prev) => ({
        ...prev,
        [slotKey]: {
          uri,
          mediaId: null,
          uploading: false,
          error: err?.message || "Upload failed. Tap the photo to retry.",
        },
      }));
    }
  }

  // Gallery path: pick + crop, then a review stop — the photo is only staged
  // for upload once the user confirms it on the ImageReview screen.
  async function pickFromGallery(slotKey, mediaKind, slotLabel) {
    setFormError("");

    let result;
    try {
      result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        quality: 0.8,
        exif: false,
      });
    } catch (err) {
      setFormError("Could not open the photo picker. Try again.");
      return;
    }

    if (result.canceled || !result.assets?.length) return;

    const pickedUri = result.assets[0].uri;

    navigation.navigate("ImageReview", {
      uri: pickedUri,
      title: slotLabel,
      subtitle:
        "Check that everything is readable — this is what the reviewer will see.",
      useId: registerCaptureCallback((uri) =>
        handleCaptured(slotKey, mediaKind, uri)
      ),
    });
  }

  function chooseSource(slotKey, mediaKind, slotLabel) {
    setFormError("");

    Alert.alert(
      slotLabel,
      "Use the guided camera, or pick a photo you already have.",
      [
        {
          text: "Take photo",
          onPress: () =>
            navigation.navigate("KYCCamera", {
              docKind: slotKey,
              captureId: registerCaptureCallback((uri) =>
                handleCaptured(slotKey, mediaKind, uri)
              ),
            }),
        },
        {
          text: "Choose from gallery",
          onPress: () => pickFromGallery(slotKey, mediaKind, slotLabel),
        },
        { text: "Cancel", style: "cancel" },
      ],
      { cancelable: true }
    );
  }

  async function handleSubmit(editableKeys) {
    setFormError("");

    const missing = editableKeys.some((key) => !docs[key]?.mediaId);

    if (missing) {
      setFormError("Retake every highlighted photo before submitting.");
      return;
    }

    if (!consent) {
      setFormError("Please accept the consent notice to continue.");
      return;
    }

    setSubmitting(true);

    try {
      // Partial resubmission: only the retaken documents go to the server —
      // approved docs keep their review state (server enforces the rules).
      await submitKyc({
        idFront: docs.id_front?.mediaId || null,
        idBack: docs.id_back?.mediaId || null,
        selfie: docs.selfie?.mediaId || null,
      });

      setDocs({ id_front: null, id_back: null, selfie: null });
      setConsent(false);
      setMode("status");
      await refresh();
    } catch (err) {
      setFormError(
        err?.message || "Could not submit your documents. Try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={[styles.safeArea, styles.center]}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.cream} />
        <ActivityIndicator size="large" color={colors.brand} />
      </SafeAreaView>
    );
  }

  const documents = statusData?.documents || {};

  // Documents are the review ground truth. If the account-level flag and the
  // document rows ever disagree, follow the documents — the gateway applies
  // the same rule on every status read (and heals the stored flag).
  const docStatuses = SLOTS.map((s) => documents[s.key]?.status || null);
  const hasDocs = docStatuses.some(Boolean);
  const allApproved = hasDocs && docStatuses.every((s) => s === "approved");
  const anyRejected = docStatuses.includes("rejected");
  const kycStatus = allApproved
    ? "verified"
    : anyRejected
    ? "rejected"
    : statusData?.kycStatus || user?.kycStatus || "unverified";
  const theme = STATUS_THEMES[kycStatus] || STATUS_THEMES.unverified;

  // Plain function, NOT a hook: this sits after the conditional loading
  // return, so hook order would break if it used useCallback here.
  function openResubmitForm() {
    setFormError("");
    setMode("form");
  }

  // Manual safety net — pull down on the status view to re-check now.
  async function onManualRefresh() {
    if (refreshing) return;

    setRefreshing(true);
    await refresh({ silent: true });
    setRefreshing(false);
  }

  // Resubmission after a (partial) rejection: only docs that were NOT
  // approved need a retake. Approved ones render locked in the form.
  const resubmitMode = kycStatus === "rejected";
  const editableKeys = resubmitMode
    ? SLOTS.filter((s) => documents[s.key]?.status !== "approved").map(
        (s) => s.key
      )
    : SLOTS.map((s) => s.key);

  // --- STATUS VIEW --------------------------------------------------------
  if (mode === "status") {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.cream} />
        <ScreenHeader
          leading="hamburger"
          eyebrow="Trust & safety"
          title={roleCopy.screenTitle}
          tone="canvas"
        />
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onManualRefresh}
              tintColor={colors.brand}
              colors={[colors.brand]}
              progressBackgroundColor={colors.white}
            />
          }
        >
          {/* ---- Sage hero: status ---- */}
          <View style={styles.heroPanel}>
            <View style={styles.orb1} />
            <View style={styles.orb2} />

            <View style={styles.heroTopRow}>
              <View style={styles.heroIconChip}>
                <TabBarIcon
                  name={
                    kycStatus === "verified"
                      ? "shield"
                      : kycStatus === "pending"
                      ? "clock"
                      : kycStatus === "rejected"
                      ? "alert-triangle"
                      : "user"
                  }
                  color={theme.text}
                  size={20}
                />
              </View>
              <View
                style={[
                  styles.heroStatusPill,
                  { backgroundColor: theme.bg, borderColor: theme.border },
                ]}
              >
                <Text style={[styles.heroStatusPillText, { color: theme.text }]}>
                  {kycStatus === "verified" && "VERIFIED"}
                  {kycStatus === "pending" && "UNDER REVIEW"}
                  {kycStatus === "rejected" && "NEEDS ATTENTION"}
                  {kycStatus === "unverified" && "NOT VERIFIED"}
                  {kycStatus === "suspended" && "SUSPENDED"}
                </Text>
              </View>
            </View>

            <Text style={styles.heroTitle}>
              {kycStatus === "verified" && "You're verified"}
              {kycStatus === "pending" && "Under review"}
              {kycStatus === "rejected" && "More info needed"}
              {kycStatus === "unverified" && "Not verified yet"}
              {kycStatus === "suspended" && "Account suspended"}
            </Text>

            <Text style={styles.heroBody}>
              {kycStatus === "verified" && roleCopy.verifiedBlurb}
              {kycStatus === "pending" &&
                "Our team is reviewing your documents right now. This usually takes less than 24 hours — this screen updates by itself the moment a decision is made."}
              {kycStatus === "rejected" &&
                "One or more of your documents could not be accepted — the reviewer's reason is shown next to each document below. Tap a flagged document to retake it, then resubmit."}
              {kycStatus === "unverified" &&
                "Upload your national ID (both sides) and a clear selfie. We review every submission within 24 hours, and your documents stay private — only HelpNest reviewers can see them."}
              {kycStatus === "suspended" &&
                "Your account is currently suspended. Contact support to resolve this."}
            </Text>
          </View>

          {loadError ? (
            <View style={styles.loadErrorBox}>
              <EmptyState
                icon="alert-triangle"
                tone="danger"
                title="Something went wrong"
                body={loadError}
              />
            </View>
          ) : null}

          {/* ---- Fast-track promo (pending only) ---- */}
          {kycStatus === "pending" ? (
            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.promoCard,
                styles.promoGold,
                pressed && styles.pressed,
              ]}
              onPress={() =>
                navigation.navigate("MpesaCheckout", {
                  plan: "verification_fast_track",
                  label: "Fast-track review (6 hours)",
                })
              }
              android_ripple={{ color: withAlpha(colors.gold, 0.12) }}
            >
              <View style={styles.promoIconGold}>
                <TabBarIcon name="zap" color={colors.goldDark} size={18} />
              </View>
              <View style={styles.promoMain}>
                <Text style={styles.promoTitle}>In a hurry?</Text>
                <Text style={styles.promoBody}>
                  Fast-track moves your review to the front of the queue —
                  target 6 hours instead of 48–72. Payment does not change the
                  outcome, only the speed.
                </Text>
              </View>
              <View style={styles.promoPricePill}>
                <Text style={styles.promoPriceText}>KES 100</Text>
              </View>
            </Pressable>
          ) : null}

          {/* ---- Appeal promo (rejected only) ---- */}
          {kycStatus === "rejected" ? (
            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.promoCard,
                styles.promoDanger,
                pressed && styles.pressed,
              ]}
              onPress={() => setAppealOpen(true)}
              android_ripple={{ color: withAlpha(colors.danger, 0.1) }}
            >
              <View style={styles.promoIconDanger}>
                <TabBarIcon name="flag" color={colors.danger} size={18} />
              </View>
              <View style={styles.promoMain}>
                <Text style={styles.promoTitle}>Think this was a mistake?</Text>
                <Text style={styles.promoBody}>
                  File an appeal and a second reviewer — not the original one —
                  re-examines your documents within 72 hours.
                </Text>
              </View>
              <TabBarIcon
                name="chevron-right"
                color={colors.danger}
                size={18}
              />
            </Pressable>
          ) : null}

          {/* ---- Chapter 01: Contact details ---- */}
          <View style={styles.chapterHead}>
            <Text style={styles.chapterNum}>01</Text>
            <View style={styles.chapterMain}>
              <Text style={styles.chapterEyebrow}>TRUST</Text>
              <Text style={styles.chapterTitle}>Contact details</Text>
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.contactRow}>
              <View
                style={[
                  styles.contactDot,
                  user?.phoneVerified
                    ? styles.contactDotOk
                    : styles.contactDotIdle,
                ]}
              />
              <Text style={styles.contactText}>
                {user?.phoneVerified
                  ? "Phone verified"
                  : "Phone not verified yet"}
              </Text>
            </View>

            {user?.email ? (
              user?.emailVerified ? (
                <View style={styles.contactRow}>
                  <View style={[styles.contactDot, styles.contactDotOk]} />
                  <Text style={styles.contactText}>Email verified</Text>
                </View>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    navigation.navigate("VerifyEmail", { email: user.email })
                  }
                  hitSlop={6}
                  style={({ pressed }) => pressed && styles.pressed}
                >
                  <View style={styles.contactRow}>
                    <View style={[styles.contactDot, styles.contactDotIdle]} />
                    <Text
                      style={[styles.contactText, styles.contactActionText]}
                    >
                      Email not verified — tap to verify
                    </Text>
                  </View>
                </Pressable>
              )
            ) : (
              <View style={styles.contactRow}>
                <View style={[styles.contactDot, styles.contactDotIdle]} />
                <Text style={styles.contactText}>No email on file</Text>
              </View>
            )}
          </View>

          {/* ---- Chapter 02: Documents ---- */}
          {hasDocs ? (
            <>
              <View style={styles.chapterHead}>
                <Text style={styles.chapterNum}>02</Text>
                <View style={styles.chapterMain}>
                  <Text style={styles.chapterEyebrow}>EVIDENCE</Text>
                  <Text style={styles.chapterTitle}>Documents</Text>
                </View>
              </View>

              <View style={styles.docsCard}>
                {SLOTS.map((slot, slotIndex) => {
                  const doc = documents[slot.key];

                  if (!doc) return null;

                  const rejected = doc.status === "rejected";

                  const rowInner = (
                    <>
                      <View style={styles.docMain}>
                        <Text style={styles.docLabel}>{slot.label}</Text>
                        {rejected && doc.rejectionReason ? (
                          <Text style={styles.docReason}>
                            Reviewer: {doc.rejectionReason}
                          </Text>
                        ) : null}
                      </View>
                      <View style={styles.docSide}>
                        <View
                          style={[
                            styles.docPill,
                            doc.status === "approved" && styles.docPillOk,
                            doc.status === "pending" && styles.docPillPending,
                            rejected && styles.docPillBad,
                          ]}
                        >
                          <Text
                            style={[
                              styles.docPillText,
                              doc.status === "approved" &&
                                styles.docPillTextOk,
                              doc.status === "pending" &&
                                styles.docPillTextPending,
                              rejected && styles.docPillTextBad,
                            ]}
                          >
                            {DOC_STATUS_LABELS[doc.status] || doc.status}
                          </Text>
                        </View>
                        {rejected ? (
                          <Text style={styles.docRetake}>Tap to retake</Text>
                        ) : null}
                      </View>
                    </>
                  );

                  return rejected ? (
                    <Pressable
                      key={slot.key}
                      style={[
                        styles.docRow,
                        slotIndex > 0 && styles.docRowDivided,
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={`Retake ${slot.label}`}
                      onPress={openResubmitForm}
                    >
                      {rowInner}
                    </Pressable>
                  ) : (
                    <View
                      key={slot.key}
                      style={[
                        styles.docRow,
                        slotIndex > 0 && styles.docRowDivided,
                      ]}
                    >
                      {rowInner}
                    </View>
                  );
                })}
              </View>
            </>
          ) : null}

          {/* ---- Primary CTA ---- */}
          {(kycStatus === "unverified" || kycStatus === "rejected") && (
            <View style={styles.ctaBlock}>
              <PrimaryButton
                label={
                  resubmitMode
                    ? "Retake rejected photos"
                    : "Start verification"
                }
                onPress={openResubmitForm}
              />
            </View>
          )}

          {/* ---- Trust strip (verified) ---- */}
          {kycStatus === "verified" ? (
            <View style={styles.trustStrip}>
              <View style={styles.trustIcon}>
                <TabBarIcon name="star" color={colors.goldDark} size={15} />
              </View>
              <Text style={styles.trustText}>
                Verified members are 3x more likely to be contacted. Keep your
                profile photo and skills updated.
              </Text>
            </View>
          ) : null}
        </ScrollView>

        {/* ---- Appeal sheet (PRD §4.7) ---- */}
        <Modal
          visible={appealOpen}
          transparent
          animationType="slide"
          onRequestClose={() => setAppealOpen(false)}
        >
          <View style={styles.appealSheetWrap}>
            <Pressable
              style={styles.appealSheetBackdrop}
              onPress={() => setAppealOpen(false)}
            />
            <View style={styles.appealSheet}>
              <View style={styles.appealGrabber} />
              <Text style={styles.appealSheetTitle}>Appeal this decision</Text>
              <Text style={styles.appealSheetHint}>
                Tell the second reviewer why you believe the rejection was a
                mistake (at least 20 characters). You will get the outcome on
                this screen and by SMS.
              </Text>
              <TextInput
                style={styles.appealSheetInput}
                value={appealMsg}
                onChangeText={setAppealMsg}
                multiline
                numberOfLines={4}
                maxLength={2000}
                placeholder="e.g. The photo was taken in daylight and every detail of my ID is readable..."
                placeholderTextColor={colors.textFaint}
              />
              <View style={styles.appealSheetActions}>
                <Pressable
                  accessibilityRole="button"
                  style={[styles.appealSheetBtn, styles.appealSheetBtnGhost]}
                  onPress={() => setAppealOpen(false)}
                  disabled={appealBusy}
                >
                  <Text style={styles.appealSheetBtnGhostText}>Cancel</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  style={[
                    styles.appealSheetBtn,
                    (appealBusy || appealMsg.trim().length < 20) &&
                      styles.appealSheetBtnDisabled,
                  ]}
                  onPress={async () => {
                    const rejectedDoc = SLOTS.map(
                      (s) => documents[s.key]
                    ).find((d) => d && d.status === "rejected");

                    if (!rejectedDoc) {
                      Alert.alert(
                        "Nothing to appeal",
                        "No rejected document was found on this account."
                      );
                      return;
                    }

                    setAppealBusy(true);
                    try {
                      const d = await fileAppeal({
                        kind: "kyc_rejection",
                        targetId: rejectedDoc.id,
                        message: appealMsg.trim(),
                      });
                      setAppealOpen(false);
                      setAppealMsg("");
                      Alert.alert(
                        "Appeal sent",
                        d.message || "A second reviewer will take a look."
                      );
                    } catch (e) {
                      Alert.alert(
                        "Could not send",
                        e?.message || "Try again in a minute."
                      );
                    } finally {
                      setAppealBusy(false);
                    }
                  }}
                  disabled={appealBusy || appealMsg.trim().length < 20}
                >
                  {appealBusy ? (
                    <ActivityIndicator size="small" color={colors.white} />
                  ) : (
                    <Text style={styles.appealSheetBtnText}>Send appeal</Text>
                  )}
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    );
  }

  // --- FORM VIEW ----------------------------------------------------------
  const allUploaded = editableKeys.every((key) => docs[key]?.mediaId);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.cream} />
      <ScreenHeader
        leading="hamburger"
        eyebrow="Trust & safety"
        title="Submit your documents"
        tone="canvas"
      />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ---- Compact sage info banner ---- */}
        <View style={styles.heroPanel}>
          <View style={styles.orb1} />
          <View style={styles.orb2} />

          <View style={styles.formHeroRow}>
            <View style={styles.heroIconChip}>
              <TabBarIcon
                name={resubmitMode ? "refresh-cw" : "camera"}
                color={colors.brand}
                size={20}
              />
            </View>
            <Text style={styles.formHeroTitle}>
              {resubmitMode
                ? "Resubmit flagged documents"
                : "Three quick photos"}
            </Text>
          </View>

          <Text style={styles.heroBody}>
            {resubmitMode
              ? "Only the flagged photos need a retake — the approved ones stay as they are. Tap a box to shoot with the guided camera or pick from your gallery."
              : "Tap a box to shoot with the guided camera or pick from your gallery — each one is checked by you before it uploads."}
          </Text>
        </View>

        {/* ---- Chapter 01: Photos ---- */}
        <View style={styles.chapterHead}>
          <Text style={styles.chapterNum}>01</Text>
          <View style={styles.chapterMain}>
            <Text style={styles.chapterEyebrow}>PHOTOS</Text>
            <Text style={styles.chapterTitle}>Documents needed</Text>
          </View>
        </View>

        <View style={styles.card}>
          {SLOTS.map((slot) => {
            const editable = editableKeys.includes(slot.key);

            if (!editable) {
              return <LockedApprovedSlot key={slot.key} label={slot.label} />;
            }

            return (
              <DocSlot
                key={slot.key}
                label={slot.label}
                hint={slot.hint}
                state={docs[slot.key]}
                disabled={submitting}
                onPick={() =>
                  chooseSource(slot.key, `kyc_${slot.key}`, slot.label)
                }
              />
            );
          })}
        </View>

        {/* ---- Chapter 02: Consent ---- */}
        <View style={styles.chapterHead}>
          <Text style={styles.chapterNum}>02</Text>
          <View style={styles.chapterMain}>
            <Text style={styles.chapterEyebrow}>AGREEMENT</Text>
            <Text style={styles.chapterTitle}>Data consent</Text>
          </View>
        </View>

        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: consent }}
          onPress={() => setConsent((v) => !v)}
          style={({ pressed }) => [
            styles.consentCard,
            pressed && styles.pressed,
          ]}
          disabled={submitting}
        >
          <View style={[styles.consentBox, consent && styles.consentBoxOn]}>
            {consent ? (
              <TabBarIcon name="check" color={colors.white} size={13} />
            ) : null}
          </View>
          <Text style={styles.consentText}>
            I agree that HelpNest may process my ID photos and selfie for
            identity verification under the Data Protection Act, 2019. Only
            HelpNest reviewers can view them — they never appear on my profile
            or in search.
          </Text>
        </Pressable>

        {/* ---- Error box ---- */}
        {formError ? (
          <View style={styles.errorBox}>
            <TabBarIcon
              name="alert-triangle"
              color={colors.danger}
              size={15}
            />
            <Text style={styles.errorText}>{formError}</Text>
          </View>
        ) : null}

        {/* ---- CTA ---- */}
        <View style={styles.ctaBlock}>
          <PrimaryButton
            label={
              resubmitMode ? "Resubmit for review" : "Submit for review"
            }
            onPress={() => handleSubmit(editableKeys)}
            loading={submitting}
            disabled={!allUploaded}
          />

          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setFormError("");
              setMode("status");
            }}
            style={styles.backLink}
            disabled={submitting}
          >
            <Text style={styles.backLinkText}>Back to status</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* ---- Appeal sheet ---- */}
      <Modal
        visible={appealOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setAppealOpen(false)}
      >
        <View style={styles.appealSheetWrap}>
          <Pressable
            style={styles.appealSheetBackdrop}
            onPress={() => setAppealOpen(false)}
          />
          <View style={styles.appealSheet}>
            <View style={styles.appealGrabber} />
            <Text style={styles.appealSheetTitle}>Appeal this decision</Text>
            <Text style={styles.appealSheetHint}>
              Tell the second reviewer why you believe the rejection was a
              mistake (at least 20 characters). You will get the outcome on
              this screen and by SMS.
            </Text>
            <TextInput
              style={styles.appealSheetInput}
              value={appealMsg}
              onChangeText={setAppealMsg}
              multiline
              numberOfLines={4}
              maxLength={2000}
              placeholder="e.g. The photo was taken in daylight and every detail of my ID is readable..."
              placeholderTextColor={colors.textFaint}
            />
            <View style={styles.appealSheetActions}>
              <Pressable
                accessibilityRole="button"
                style={[styles.appealSheetBtn, styles.appealSheetBtnGhost]}
                onPress={() => setAppealOpen(false)}
                disabled={appealBusy}
              >
                <Text style={styles.appealSheetBtnGhostText}>Cancel</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                style={[
                  styles.appealSheetBtn,
                  (appealBusy || appealMsg.trim().length < 20) &&
                    styles.appealSheetBtnDisabled,
                ]}
                onPress={async () => {
                  const rejectedDoc = SLOTS.map((s) => documents[s.key]).find(
                    (d) => d && d.status === "rejected"
                  );

                  if (!rejectedDoc) {
                    Alert.alert(
                      "Nothing to appeal",
                      "No rejected document was found on this account."
                    );
                    return;
                  }

                  setAppealBusy(true);
                  try {
                    const d = await fileAppeal({
                      kind: "kyc_rejection",
                      targetId: rejectedDoc.id,
                      message: appealMsg.trim(),
                    });
                    setAppealOpen(false);
                    setAppealMsg("");
                    Alert.alert(
                      "Appeal sent",
                      d.message || "A second reviewer will take a look."
                    );
                  } catch (e) {
                    Alert.alert(
                      "Could not send",
                      e?.message || "Try again in a minute."
                    );
                  } finally {
                    setAppealBusy(false);
                  }
                }}
                disabled={appealBusy || appealMsg.trim().length < 20}
              >
                {appealBusy ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Text style={styles.appealSheetBtnText}>Send appeal</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.88,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 48,
  },

  /* ============================================================
     Sage hero panel — status / info banner.
     ============================================================ */
  heroPanel: {
    backgroundColor: colors.mist,
    marginHorizontal: -20,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 22,
    marginBottom: 18,
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
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 12,
  },
  heroIconChip: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.ink,
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  heroStatusPill: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  heroStatusPillText: {
    fontSize: 9.5,
    fontWeight: "800",
    letterSpacing: 1.1,
  },
  heroTitle: {
    color: colors.ink,
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.6,
    lineHeight: 28,
    marginBottom: 8,
  },
  heroBody: {
    color: colors.textMuted,
    fontSize: 13.5,
    lineHeight: 20,
    fontWeight: "500",
  },

  formHeroRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  formHeroTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.3,
    flex: 1,
  },

  loadErrorBox: {
    marginBottom: 14,
  },

  /* ============================================================
     Insight promos — fast-track (gold) & appeal (danger).
     ============================================================ */
  promoCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    marginBottom: 18,
    overflow: "hidden",
    gap: 12,
  },
  promoGold: {
    backgroundColor: withAlpha(colors.gold, 0.08),
    borderColor: withAlpha(colors.gold, 0.28),
  },
  promoDanger: {
    backgroundColor: withAlpha(colors.danger, 0.05),
    borderColor: withAlpha(colors.danger, 0.22),
  },
  promoIconGold: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: withAlpha(colors.gold, 0.2),
    alignItems: "center",
    justifyContent: "center",
  },
  promoIconDanger: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: withAlpha(colors.danger, 0.12),
    alignItems: "center",
    justifyContent: "center",
  },
  promoMain: {
    flex: 1,
  },
  promoTitle: {
    color: colors.ink,
    fontSize: 14.5,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  promoBody: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "500",
    marginTop: 3,
  },
  promoPricePill: {
    backgroundColor: colors.gold,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  promoPriceText: {
    color: colors.ink,
    fontSize: 11.5,
    fontWeight: "800",
    letterSpacing: 0.1,
  },

  /* ============================================================
     Chapter heads.
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

  /* ============================================================
     Cards.
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

  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 36,
    paddingVertical: 6,
  },
  contactDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 10,
  },
  contactDotOk: {
    backgroundColor: colors.brandSoft,
  },
  contactDotIdle: {
    backgroundColor: colors.gold,
  },
  contactText: {
    color: colors.ink,
    fontSize: 13.5,
    fontWeight: "600",
    flex: 1,
  },
  contactActionText: {
    color: colors.brand,
    fontWeight: "800",
  },

  /* ---- Documents list ---- */
  docsCard: {
    backgroundColor: colors.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: withAlpha(colors.ink, 0.05),
    padding: 6,
    marginBottom: 18,
    shadowColor: colors.ink,
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  docRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 56,
    paddingVertical: 13,
    paddingHorizontal: 12,
  },
  docRowDivided: {
    borderTopWidth: 1,
    borderTopColor: withAlpha(colors.ink, 0.06),
  },
  docMain: {
    flex: 1,
    marginRight: 10,
  },
  docLabel: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "700",
  },
  docReason: {
    color: colors.danger,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },
  docSide: {
    alignItems: "flex-end",
    gap: 4,
  },
  docPill: {
    backgroundColor: colors.mist,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  docPillOk: {
    backgroundColor: withAlpha(colors.brand, 0.1),
  },
  docPillPending: {
    backgroundColor: withAlpha(colors.gold, 0.16),
  },
  docPillBad: {
    backgroundColor: withAlpha(colors.danger, 0.1),
  },
  docPillText: {
    fontSize: 11.5,
    fontWeight: "800",
    color: colors.textMuted,
  },
  docPillTextOk: {
    color: colors.brand,
  },
  docPillTextPending: {
    color: colors.goldDark,
  },
  docPillTextBad: {
    color: colors.danger,
  },
  docRetake: {
    color: colors.brand,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.1,
  },

  /* ---- CTA block ---- */
  ctaBlock: {
    marginTop: 4,
  },

  /* ---- Trust strip ---- */
  trustStrip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: withAlpha(colors.brand, 0.05),
    borderRadius: 16,
    padding: 14,
    marginTop: 4,
    gap: 10,
  },
  trustIcon: {
    width: 32,
    height: 32,
    borderRadius: 11,
    backgroundColor: withAlpha(colors.gold, 0.2),
    alignItems: "center",
    justifyContent: "center",
  },
  trustText: {
    flex: 1,
    color: colors.brand,
    fontSize: 12.5,
    lineHeight: 18,
    fontWeight: "600",
  },

  /* ============================================================
     Doc slots (form view).
     ============================================================ */
  slot: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  slotLocked: {
    opacity: 0.92,
  },
  slotPress: {
    width: 80,
    height: 80,
  },
  slotLockedThumb: {
    borderRadius: 16,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  slotLockedHint: {
    color: colors.brand,
    fontWeight: "600",
  },
  slotThumb: {
    width: 80,
    height: 80,
    borderRadius: 16,
    backgroundColor: colors.mist,
  },
  slotEmpty: {
    width: 80,
    height: 80,
    borderRadius: 16,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: colors.mistDark,
    backgroundColor: withAlpha(colors.brand, 0.03),
    alignItems: "center",
    justifyContent: "center",
  },
  slotPlus: {
    color: colors.textFaint,
    fontSize: 28,
    fontWeight: "400",
    marginTop: -4,
  },
  slotPill: {
    position: "absolute",
    right: -6,
    bottom: -6,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.textMuted,
    borderWidth: 2,
    borderColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  slotPillOk: {
    backgroundColor: colors.brand,
  },
  slotPillError: {
    backgroundColor: colors.danger,
  },
  slotCopy: {
    flex: 1,
    marginLeft: 14,
  },
  slotLabel: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "800",
  },
  slotHint: {
    color: colors.textMuted,
    fontSize: 12.5,
    lineHeight: 18,
    marginTop: 3,
  },
  slotHintError: {
    color: colors.danger,
    fontWeight: "600",
  },

  /* ============================================================
     Consent card.
     ============================================================ */
  consentCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: colors.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: withAlpha(colors.ink, 0.05),
    padding: 16,
    marginBottom: 16,
    shadowColor: colors.ink,
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  consentBox: {
    width: 22,
    height: 22,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.mistDark,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    marginTop: 1,
  },
  consentBoxOn: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  consentText: {
    flex: 1,
    color: colors.ink,
    fontSize: 12.5,
    lineHeight: 18,
    fontWeight: "600",
  },

  /* ---- Error box ---- */
  errorBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: withAlpha(colors.danger, 0.07),
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
  },
  errorText: {
    flex: 1,
    color: colors.danger,
    fontSize: 13,
    lineHeight: 19,
  },
  backLink: {
    alignItems: "center",
    paddingVertical: 12,
    marginTop: 4,
  },
  backLinkText: {
    color: colors.brand,
    fontSize: 13.5,
    fontWeight: "800",
  },

  /* ============================================================
     Appeal sheet.
     ============================================================ */
  appealSheetWrap: { flex: 1, justifyContent: "flex-end" },
  appealSheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: withAlpha(colors.ink, 0.45),
  },
  appealSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    padding: 24,
    paddingBottom: 40,
  },
  appealGrabber: {
    alignSelf: "center",
    width: 44,
    height: 4,
    borderRadius: 999,
    backgroundColor: colors.cloud,
    marginBottom: 16,
  },
  appealSheetTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  appealSheetHint: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 8,
    marginBottom: 14,
  },
  appealSheetInput: {
    borderWidth: 1,
    borderColor: withAlpha(colors.ink, 0.08),
    borderRadius: 14,
    backgroundColor: withAlpha(colors.ink, 0.04),
    padding: 14,
    minHeight: 100,
    textAlignVertical: "top",
    color: colors.ink,
    fontSize: 14,
  },
  appealSheetActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 14,
  },
  appealSheetBtn: {
    backgroundColor: colors.brand,
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingVertical: 13,
    minHeight: 48,
    minWidth: 110,
    alignItems: "center",
    justifyContent: "center",
  },
  appealSheetBtnText: { color: colors.white, fontWeight: "800", fontSize: 14 },
  appealSheetBtnGhost: {
    backgroundColor: withAlpha(colors.ink, 0.06),
  },
  appealSheetBtnGhostText: {
    color: colors.ink,
    fontWeight: "700",
    fontSize: 14,
  },
  appealSheetBtnDisabled: { opacity: 0.45 },
});