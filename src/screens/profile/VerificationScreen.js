import React, { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";

import PrimaryButton from "../../components/ui/PrimaryButton";
import HamburgerButton from "../../components/ui/HamburgerButton";
import TabBarIcon from "../../components/ui/TabBarIcon";
import { useAuth } from "../../context/AuthContext";
import { uploadMedia } from "../../services/mediaService";
import { getKycStatus, submitKyc } from "../../services/kycService";
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
  verified: { bg: "#EAF7EE", border: "#BFE3C8", text: "#1F7A3D" },
  pending: { bg: "#FFF6E5", border: "#F0DFBC", text: "#8A6116" },
  rejected: { bg: "#FFF0EE", border: "#F2CFC9", text: "#7D2922" },
  unverified: { bg: colors.mist, border: colors.mistDark, text: colors.ink },
};

const DOC_STATUS_LABELS = {
  pending: "Awaiting review",
  approved: "Approved",
  rejected: "Needs retake",
};

const ROLE_COPY = {
  maid: {
    screenTitle: "ID verification",
    intro:
      "A verified badge makes employers trust your profile instantly — verified workers get messaged first.",
    verifiedBlurb:
      "Your badge is now live on your profile. Employers see it everywhere your name appears.",
  },
  employer: {
    screenTitle: "Account verification",
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
        style={styles.slotPress}
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
        <Text style={styles.slotHint}>
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
          setLoadError(err?.message || "Could not load your verification status.");
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
      onUse: (uri) => handleCaptured(slotKey, mediaKind, uri),
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
              onCaptured: (uri) => handleCaptured(slotKey, mediaKind, uri),
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
      setFormError(err?.message || "Could not submit your documents. Try again.");
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
    ? SLOTS.filter((s) => documents[s.key]?.status !== "approved").map((s) => s.key)
    : SLOTS.map((s) => s.key);

  // --- STATUS VIEW --------------------------------------------------------
  if (mode === "status") {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.cream} />
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
          <View style={styles.menuRow}>
            <HamburgerButton />
          </View>

          <Text style={styles.title}>{roleCopy.screenTitle}</Text>
          <Text style={styles.subtitle}>{roleCopy.intro}</Text>

          {loadError ? (
            <View style={[styles.statusCard, { backgroundColor: "#FFF0EE", borderColor: "#F2CFC9" }]}>
              <Text style={[styles.statusTitle, { color: "#7D2922" }]}>
                Something went wrong
              </Text>
              <Text style={[styles.statusBody, { color: "#7D2922" }]}>{loadError}</Text>
            </View>
          ) : null}

          <View style={[styles.statusCard, { backgroundColor: theme.bg, borderColor: theme.border }]}>
            <View style={styles.statusHead}>
              <TabBarIcon
                name={kycStatus === "verified" ? "shield" : kycStatus === "pending" ? "clock" : "user"}
                color={theme.text}
                size={22}
              />
              <Text style={[styles.statusTitle, { color: theme.text }]}>
                {kycStatus === "verified" && "You're verified"}
                {kycStatus === "pending" && "Under review"}
                {kycStatus === "rejected" && "More info needed"}
                {kycStatus === "unverified" && "Not verified yet"}
                {kycStatus === "suspended" && "Account suspended"}
              </Text>
            </View>

            <Text style={[styles.statusBody, { color: theme.text }]}>
              {kycStatus === "verified" && roleCopy.verifiedBlurb}
              {kycStatus === "pending" &&
                "Our team is reviewing your documents right now. This usually takes less than 24 hours — this screen updates by itself the moment a decision is made."
              }
              {kycStatus === "rejected" &&
                "One or more of your documents could not be accepted — the reviewer's reason is shown next to each document below. Tap a flagged document to retake it, then resubmit."
              }
              {kycStatus === "unverified" &&
                "Upload your national ID (both sides) and a clear selfie. We review every submission within 24 hours, and your documents stay private — only HelpNest reviewers can see them."
              }
              {kycStatus === "suspended" &&
                "Your account is currently suspended. Contact support to resolve this."
              }
            </Text>
          </View>

          {/* Document outcomes — shown whenever any document exists, so the
              user can see exactly what the reviewer decided per photo. */}
          {hasDocs ? (
            <View style={styles.docsCard}>
              {SLOTS.map((slot) => {
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
                      <Text
                        style={[
                          styles.docState,
                          doc.status === "approved" && styles.docStateOk,
                          rejected && styles.docStateBad,
                        ]}
                      >
                        {DOC_STATUS_LABELS[doc.status] || doc.status}
                      </Text>
                      {rejected ? (
                        <Text style={styles.docRetake}>Tap to retake</Text>
                      ) : null}
                    </View>
                  </>
                );

                // A rejected document IS the retake entry point — tapping the
                // row jumps straight into the resubmission form for it.
                return rejected ? (
                  <Pressable
                    key={slot.key}
                    style={styles.docRow}
                    accessibilityRole="button"
                    accessibilityLabel={`Retake ${slot.label}`}
                    onPress={openResubmitForm}
                  >
                    {rowInner}
                  </Pressable>
                ) : (
                  <View key={slot.key} style={styles.docRow}>{rowInner}</View>
                );
              })}
            </View>
          ) : null}

          {(kycStatus === "unverified" || kycStatus === "rejected") && (
            <PrimaryButton
              label={resubmitMode ? "Retake rejected photos" : "Start verification"}
              onPress={openResubmitForm}
            />
          )}

          {kycStatus === "verified" ? (
            <View style={styles.trustStrip}>
              <TabBarIcon name="star" color={colors.goldDark} size={16} />
              <Text style={styles.trustText}>
                Verified members are 3x more likely to be contacted. Keep your
                profile photo and skills updated.
              </Text>
            </View>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // --- FORM VIEW ----------------------------------------------------------
  const allUploaded = editableKeys.every((key) => docs[key]?.mediaId);

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

        <Text style={styles.title}>Submit your documents</Text>
        <Text style={styles.subtitle}>
          {resubmitMode
            ? "Only the flagged photos need a retake — the approved ones stay as they are. Tap a box to shoot with the guided camera or pick from your gallery."
            : "Three quick photos. Tap a box to shoot with the guided camera or pick from your gallery — each one is checked by you before it uploads."}
        </Text>

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
                onPick={() => chooseSource(slot.key, `kyc_${slot.key}`, slot.label)}
              />
            );
          })}

          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: consent }}
            onPress={() => setConsent((v) => !v)}
            style={styles.consentRow}
            disabled={submitting}
          >
            <View style={[styles.consentBox, consent && styles.consentBoxOn]}>
              {consent ? <TabBarIcon name="check" color={colors.white} size={13} /> : null}
            </View>
            <Text style={styles.consentText}>
              I agree that HelpNest may process my ID photos and selfie for
              identity verification under the Data Protection Act, 2019. Only
              HelpNest reviewers can view them — they never appear on my
              profile or in search.
            </Text>
          </Pressable>

          {formError ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{formError}</Text>
            </View>
          ) : null}

          <PrimaryButton
            label={resubmitMode ? "Resubmit for review" : "Submit for review"}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  flex: {
    flex: 1,
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: {
    padding: 22,
    paddingBottom: 60,
  },
  menuRow: {
    marginBottom: 12,
  },
  title: {
    color: colors.ink,
    fontSize: 25,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 13.5,
    lineHeight: 20,
    marginTop: 4,
    marginBottom: 16,
  },
  statusCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
    marginBottom: 14,
  },
  statusHead: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  statusTitle: {
    fontSize: 17,
    fontWeight: "800",
    marginLeft: 10,
  },
  statusBody: {
    fontSize: 13.5,
    lineHeight: 20,
  },
  docsCard: {
    backgroundColor: colors.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.mist,
    padding: 6,
    marginBottom: 14,
  },
  docRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  docMain: {
    flex: 1,
    marginRight: 10,
  },
  docLabel: {
    color: colors.ink,
    fontSize: 13.5,
    fontWeight: "700",
  },
  docReason: {
    color: "#7D2922",
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },
  docSide: {
    alignItems: "flex-end",
  },
  docState: {
    fontSize: 12.5,
    fontWeight: "800",
    color: colors.textMuted,
  },
  docRetake: {
    color: colors.brand,
    fontSize: 11.5,
    fontWeight: "800",
    marginTop: 3,
  },
  docStateOk: {
    color: "#1F7A3D",
  },
  docStateBad: {
    color: "#7D2922",
  },
  trustStrip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.mist,
    padding: 14,
    marginTop: 4,
  },
  trustText: {
    flex: 1,
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    marginLeft: 10,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.mist,
    padding: 18,
  },
  slot: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  slotLocked: {
    opacity: 0.92,
  },
  slotPress: {
    width: 84,
    height: 84,
  },
  slotLockedThumb: {
    borderRadius: 14,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  slotLockedHint: {
    color: "#1F7A3D",
    fontWeight: "600",
  },
  slotThumb: {
    width: 84,
    height: 84,
    borderRadius: 14,
    backgroundColor: colors.mist,
  },
  slotEmpty: {
    width: 84,
    height: 84,
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: colors.mistDark,
    backgroundColor: colors.cream,
    alignItems: "center",
    justifyContent: "center",
  },
  slotPlus: {
    color: colors.textMuted,
    fontSize: 30,
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
    backgroundColor: "#B3493E",
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
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },
  consentRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: colors.mist,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  consentBox: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: colors.mistDark,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 11,
    marginTop: 1,
  },
  consentBoxOn: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  consentText: {
    flex: 1,
    color: colors.ink,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "600",
  },
  errorBox: {
    backgroundColor: "#FFF0EE",
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  errorText: {
    color: "#7D2922",
    fontSize: 13,
    lineHeight: 19,
  },
  backLink: {
    alignItems: "center",
    paddingVertical: 12,
  },
  backLinkText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "700",
  },
});
