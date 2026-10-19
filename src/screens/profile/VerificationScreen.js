import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
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
//   status view (default) -> form view (ID front / ID back / selfie, each
//   captured with the guided camera or picked from the gallery, then uploaded
//   immediately through the media API) -> DPA 2019 consent -> submit -> back
//   to status view ("under review").
// Server review flips the status; this screen always re-fetches on focus.

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

  const refresh = useCallback(async () => {
    setLoadError("");

    try {
      const data = await getKycStatus();
      setStatusData(data);
    } catch (err) {
      setLoadError(err?.message || "Could not load your verification status.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
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

  async function pickFromGallery(slotKey, mediaKind) {
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

    await handleCaptured(slotKey, mediaKind, result.assets[0].uri);
  }

  function chooseSource(slotKey, mediaKind) {
    setFormError("");
    const label =
      SLOTS.find((slot) => slot.key === slotKey)?.label || "Add a photo";

    Alert.alert(
      label,
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
          onPress: () => pickFromGallery(slotKey, mediaKind),
        },
        { text: "Cancel", style: "cancel" },
      ],
      { cancelable: true }
    );
  }

  async function handleSubmit() {
    setFormError("");

    const missing = SLOTS.some((slot) => !docs[slot.key]?.mediaId);

    if (missing) {
      setFormError("Add all three photos before submitting.");
      return;
    }

    if (!consent) {
      setFormError("Please accept the consent notice to continue.");
      return;
    }

    setSubmitting(true);

    try {
      await submitKyc({
        idFront: docs.id_front.mediaId,
        idBack: docs.id_back.mediaId,
        selfie: docs.selfie.mediaId,
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

  const kycStatus = statusData?.kycStatus || user?.kycStatus || "unverified";
  const documents = statusData?.documents || {};
  const rejectionReason =
    SLOTS.map((s) => documents[s.key]?.rejectionReason).find(Boolean) || null;
  const theme = STATUS_THEMES[kycStatus] || STATUS_THEMES.unverified;

  // --- STATUS VIEW --------------------------------------------------------
  if (mode === "status") {
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
                "Our team is reviewing your documents right now. This usually takes less than 24 hours — the status on this screen updates automatically when we're done."
              }
              {kycStatus === "rejected" &&
                (rejectionReason ||
                  "One of your documents could not be accepted. Please retake it and submit again.")
              }
              {kycStatus === "unverified" &&
                "Upload your national ID (both sides) and a clear selfie. We review every submission within 24 hours, and your documents stay private — only HelpNest reviewers can see them."
              }
              {kycStatus === "suspended" &&
                "Your account is currently suspended. Contact support to resolve this."
              }
            </Text>
          </View>

          {/* Document outcomes while a submission is in flight or reviewed */}
          {(kycStatus === "pending" || kycStatus === "rejected") &&
          SLOTS.some((s) => documents[s.key]) ? (
            <View style={styles.docsCard}>
              {SLOTS.map((slot) => {
                const doc = documents[slot.key];

                if (!doc) return null;

                return (
                  <View key={slot.key} style={styles.docRow}>
                    <Text style={styles.docLabel}>{slot.label}</Text>
                    <Text
                      style={[
                        styles.docState,
                        doc.status === "approved" && styles.docStateOk,
                        doc.status === "rejected" && styles.docStateBad,
                      ]}
                    >
                      {DOC_STATUS_LABELS[doc.status] || doc.status}
                    </Text>
                  </View>
                );
              })}
            </View>
          ) : null}

          {(kycStatus === "unverified" || kycStatus === "rejected") && (
            <PrimaryButton
              label={kycStatus === "rejected" ? "Resubmit documents" : "Start verification"}
              onPress={() => {
                setFormError("");
                setMode("form");
              }}
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
  const allUploaded = SLOTS.every((slot) => docs[slot.key]?.mediaId);

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
          Three quick photos. Tap a box to shoot with the guided camera or pick
          from your gallery — each one uploads as soon as it's ready.
        </Text>

        <View style={styles.card}>
          {SLOTS.map((slot) => (
            <DocSlot
              key={slot.key}
              label={slot.label}
              hint={slot.hint}
              state={docs[slot.key]}
              disabled={submitting}
              onPick={() => chooseSource(slot.key, `kyc_${slot.key}`)}
            />
          ))}

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
            label="Submit for review"
            onPress={handleSubmit}
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
  docLabel: {
    color: colors.ink,
    fontSize: 13.5,
    fontWeight: "700",
  },
  docState: {
    fontSize: 12.5,
    fontWeight: "800",
    color: colors.textMuted,
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
  slotPress: {
    width: 84,
    height: 84,
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
