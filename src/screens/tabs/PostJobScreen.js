import React, { useCallback, useRef, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
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

import { useAuth } from "../../context/AuthContext";
import { createJob } from "../../services/jobsService";
import { getSubscriptionStatus } from "../../services/subscriptionsService";
import JobPostModal from "../../components/ui/JobPostModal";
import ScreenHeader from "../../components/ui/ScreenHeader";
import PrimaryButton from "../../components/ui/PrimaryButton";
import TabBarIcon from "../../components/ui/TabBarIcon";
import { SERVICE_OPTIONS } from "../../utils/workerMeta";
import { colors, withAlpha } from "../../theme/colors";

// ---------------------------------------------------------------------------
// Post a job — form -> server-side entitlement check -> optional paywall.
//
// Flow: submit calls POST /api/jobs. When the server answers 402 (no active
// subscription and no unused post credit) the SAME payload is held
// in pendingPayloadRef and the JobPostModal opens (one-time post vs plans).
// After an M-Pesa purchase the user lands back here, the focus effect
// retries the held payload, and the job publishes itself.
//
// v3: ScreenHeader back bar, grouped form cards, eyebrow field labels and a
// large pinned submit CTA. Logic untouched.
// ---------------------------------------------------------------------------
export default function PostJobScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState(null);
  const [description, setDescription] = useState("");
  const [area, setArea] = useState(user?.locationLabel || "");
  const [rate, setRate] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [gateOpen, setGateOpen] = useState(false);

  // Server-known entitlement (drives the submit button copy only — the
  // server is the source of truth and re-checks on every submission).
  const [canPostJob, setCanPostJob] = useState(null);

  const submittingRef = useRef(false);
  const pendingPayloadRef = useRef(null);

  const submitJob = useCallback(
    async (payload) => {
      if (submittingRef.current) return;
      submittingRef.current = true;
      setSubmitting(true);
      setFormError("");

      try {
        await createJob(payload);

        pendingPayloadRef.current = null;
        setSubmitting(false);
        submittingRef.current = false;

        Alert.alert(
          "Job posted",
          "Maids can now see your listing. You can manage it under My Jobs.",
          [
            { text: "Post another", onPress: resetForm, style: "cancel" },
            {
              text: "View my jobs",
              onPress: () => navigation.navigate("MyJobsTab"),
            },
          ]
        );
      } catch (err) {
        submittingRef.current = false;

        if (err?.status === 402) {
          // No entitlement — hold the payload and open the payment sheet.
          pendingPayloadRef.current = payload;
          setSubmitting(false);
          setGateOpen(true);
          return;
        }

        setSubmitting(false);
        setFormError(err?.message || "Could not post the job. Try again.");
      }
    },
    [navigation]
  );

  function resetForm() {
    setTitle("");
    setCategory(null);
    setDescription("");
    setRate("");
    setFormError("");
    // Keep the last area — posters usually list in the same neighbourhood.
  }

  // On every focus: refresh the entitlement for button copy, and retry a
  // payload that was held back for payment (covers the return from the
  // M-Pesa checkout — subscription or one-time credit now active).
  useFocusEffect(
    useCallback(() => {
      let active = true;

      (async () => {
        try {
          const status = await getSubscriptionStatus();

          if (active) setCanPostJob(Boolean(status?.canPostJob));
        } catch {
          // Copy-only nicety — the server re-checks on submit anyway.
        }
      })();

      const payload = pendingPayloadRef.current;

      if (payload) {
        (async () => {
          try {
            await createJob(payload);

            pendingPayloadRef.current = null;

            if (!active) return;

            setSubmitting(false);
            submittingRef.current = false;

            Alert.alert(
              "Job posted",
              "Maids can now see your listing. You can manage it under My Jobs.",
              [
                { text: "Post another", onPress: resetForm, style: "cancel" },
                {
                  text: "View my jobs",
                  onPress: () => navigation.navigate("MyJobsTab"),
                },
              ]
            );
          } catch (err) {
            if (!active) return;

            submittingRef.current = false;
            setSubmitting(false);

            if (err?.status !== 402) {
              pendingPayloadRef.current = null;
              setFormError(err?.message || "Could not post the job. Try again.");
            } else {
              setGateOpen(true);
            }
          }
        })();
      }

      return () => {
        active = false;
      };
    }, [navigation])
  );

  const handleSubmit = () => {
    const trimmedTitle = title.trim();

    if (trimmedTitle.length < 6) {
      setFormError("Give the job a title of at least 6 characters.");
      return;
    }

    if (!category) {
      setFormError("Pick what the job is about.");
      return;
    }

    const trimmedRate = rate.trim();
    const rateKes = trimmedRate ? Number(trimmedRate) : null;

    if (trimmedRate && (!Number.isInteger(rateKes) || rateKes < 50)) {
      setFormError("Offered pay should be a whole amount of KES 50 or more.");
      return;
    }

    submitJob({
      title: trimmedTitle,
      description: description.trim() || null,
      category,
      locationLabel: area.trim() || null,
      rateKes,
    });
  };

  const feeHint =
    canPostJob === true
      ? "Your plan covers posting — this one is free."
      : canPostJob === false
        ? "Posting costs KES 300, or is included with a plan."
        : "You can review everything before it goes live.";

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.cream} />

      <ScreenHeader
        title="Post a job"
        eyebrow="New listing"
        leading="back"
        onBack={() => navigation.goBack()}
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.feeCard}>
            <View style={styles.feeIcon}>
              <TabBarIcon
                name={canPostJob === true ? "check-circle" : "credit-card"}
                color={colors.brand}
                size={15}
              />
            </View>
            <Text style={styles.feeText}>{feeHint}</Text>
          </View>

          <View style={[styles.groupCard, styles.groupGap]}>
            <Text style={styles.groupTitle}>The basics</Text>

            <Text style={styles.label}>Job title</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. Full-time house help in Kilimani"
              placeholderTextColor={colors.cloud}
              maxLength={120}
            />

            <Text style={styles.label}>What do you need help with?</Text>
            <View style={styles.chipsWrap}>
              {SERVICE_OPTIONS.map((option) => {
                const on = category === option.value;

                return (
                  <Pressable
                    key={option.value}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    style={({ pressed }) => [
                      styles.chip,
                      on && styles.chipOn,
                      pressed && styles.pressed,
                    ]}
                    android_ripple={{
                      color: withAlpha(colors.brand, 0.08),
                      borderless: false,
                      radius: 14,
                    }}
                    onPress={() => setCategory(option.value)}
                  >
                    <Text style={[styles.chipText, on && styles.chipTextOn]}>
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={[styles.groupCard, styles.groupGap]}>
            <Text style={styles.groupTitle}>The details</Text>

            <Text style={styles.label}>Details (optional)</Text>
            <TextInput
              style={[styles.input, styles.inputMultiline, styles.inputLast]}
              value={description}
              onChangeText={setDescription}
              placeholder="Duties, days, hours, anything else that matters…"
              placeholderTextColor={colors.cloud}
              multiline
              maxLength={2000}
            />
          </View>

          <View style={[styles.groupCard, styles.groupGap]}>
            <Text style={styles.groupTitle}>Where & pay</Text>

            <Text style={styles.label}>Area</Text>
            <TextInput
              style={styles.input}
              value={area}
              onChangeText={setArea}
              placeholder="e.g. Kilimani, Nairobi"
              placeholderTextColor={colors.cloud}
              maxLength={160}
            />

            <Text style={styles.label}>Offered pay (KES, optional)</Text>
            <TextInput
              style={[styles.input, styles.inputLast]}
              value={rate}
              onChangeText={setRate}
              placeholder="e.g. 800"
              placeholderTextColor={colors.cloud}
              keyboardType="number-pad"
              maxLength={7}
            />
          </View>

          {formError ? (
            <View style={styles.formErrorCard}>
              <TabBarIcon
                name="alert-triangle"
                color={colors.danger}
                size={14}
              />
              <Text style={styles.formErrorText}>{formError}</Text>
            </View>
          ) : null}
        </ScrollView>

        <View style={styles.submitBar}>
          <PrimaryButton
            label={canPostJob === false ? "Continue · from KES 300" : "Post job"}
            onPress={handleSubmit}
            loading={submitting}
            disabled={submitting}
          />

          {canPostJob === false ? (
            <Text style={styles.submitNote}>
              We'll check your plan when you continue — if it's covered the
              job posts right away, otherwise you'll pick how to pay.
            </Text>
          ) : null}
        </View>
      </KeyboardAvoidingView>

      <JobPostModal
        visible={gateOpen}
        onClose={() => setGateOpen(false)}
        jobTitle={title}
      />
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
  scroll: {
    padding: 20,
    paddingTop: 12,
    paddingBottom: 28,
  },
  feeCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.mist,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
    shadowColor: colors.ink,
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  feeIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: withAlpha(colors.brand, 0.1),
    alignItems: "center",
    justifyContent: "center",
  },
  feeText: {
    flex: 1,
    color: colors.ink,
    fontSize: 12.5,
    lineHeight: 18,
    fontWeight: "600",
  },
  groupCard: {
    backgroundColor: colors.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.mist,
    padding: 18,
    shadowColor: colors.ink,
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 1,
  },
  groupGap: {
    marginBottom: 14,
  },
  groupTitle: {
    color: colors.goldDark,
    fontSize: 10.5,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 14,
  },
  label: {
    color: colors.textMuted,
    fontSize: 11.5,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  input: {
    backgroundColor: colors.cream,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.mist,
    color: colors.ink,
    fontSize: 14,
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
  },
  inputMultiline: {
    minHeight: 104,
    textAlignVertical: "top",
  },
  inputLast: {
    marginBottom: 2,
  },
  chipsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.mist,
    paddingHorizontal: 13,
    paddingVertical: 9,
    backgroundColor: colors.cream,
    overflow: "hidden",
  },
  chipOn: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  chipText: {
    color: colors.ink,
    fontSize: 12.5,
    fontWeight: "700",
  },
  chipTextOn: {
    color: colors.white,
  },
  formErrorCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    backgroundColor: withAlpha(colors.danger, 0.1),
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 2,
  },
  formErrorText: {
    flex: 1,
    color: colors.danger,
    fontSize: 12.5,
    lineHeight: 18,
    fontWeight: "600",
  },
  submitBar: {
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.mist,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14,
  },
  submitNote: {
    color: colors.textMuted,
    fontSize: 11.5,
    lineHeight: 16,
    textAlign: "center",
    marginTop: 9,
    paddingHorizontal: 8,
  },
  pressed: {
    opacity: 0.88,
  },
});
