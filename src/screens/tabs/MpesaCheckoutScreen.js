import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";

import { useAuth } from "../../context/AuthContext";
import { startStkPush, getTransaction } from "../../services/paymentsService";
import TabBarIcon from "../../components/ui/TabBarIcon";
import { formatPhoneDisplay } from "../../utils/phone";
import { colors, withAlpha } from "../../theme/colors";

// Display-only mirror of the server-side catalog (utils/catalog.js on the
// gateway — PRD v1.1 §5; amounts are still looked up server-side at push
// time).
const PLAN_META = {
  test_kes1: { label: "M-Pesa test payment", amountKes: 1 },
  contact_unlock: { label: "Unlock a worker's contact", amountKes: 300 },
  chat_pass: { label: "Chat unlock", amountKes: 150 },
  hire_pass: { label: "Hire Pass — 5 chats + 1 job post", amountKes: 500 },
  emp_basic: { label: "Basic — 3 chats + 3 job posts", amountKes: 499 },
  emp_gold: { label: "Gold — 7 chats + 5 job posts", amountKes: 899 },
  apply_pass: { label: "1 application", amountKes: 50 },
  maid_basic: { label: "Basic — 3 applications", amountKes: 199 },
  maid_gold: { label: "Gold — 10 applications", amountKes: 349 },
  // Legacy — still bookable for older installs, hidden from new paywalls.
  chat_week: { label: "Unlimited chats — 1 week", amountKes: 250 },
  chat_month: { label: "Unlimited chats — 1 month", amountKes: 800 },
  job_post: { label: "Standard job post", amountKes: 300 },
  // Promotions (PRD §5, §18) — prices shown are the current hypotheses; the
  // gateway charges whatever the plans table has at push time.
  profile_boost: { label: "Profile boost — 7 days featured", amountKes: 100 },
  verification_fast_track: { label: "Fast-track review (6 hours)", amountKes: 100 },
  urgent_boost: { label: "Urgent boost — 24h urgent placement", amountKes: 100 },
  spotlight: { label: "Spotlight — 24h pinned placement", amountKes: 200 },
};

// Plans tied to ONE worker — the workerId rides along as STK metadata so
// the backend can attribute the entitlement after the callback.
const WORKER_SCOPED = new Set(["contact_unlock", "chat_pass"]);

const POLL_INTERVAL_MS = 3000;
const POLL_MAX_ATTEMPTS = 40; // ~2 minutes

const STEPS = ["Request", "Enter PIN", "Confirm"];

export default function MpesaCheckoutScreen() {
  const navigation = useNavigation();
  const { params } = useRoute();
  const { user } = useAuth();

  const planId = params?.plan || "test_kes1";
  const meta = PLAN_META[planId] || PLAN_META.test_kes1;
  const label = params?.label || meta.label;
  // Which worker a contact_unlock payment applies to — forwarded as STK
  // metadata so the backend can attribute the unlock after the callback.
  const workerId = params?.workerId || null;
  // Which job a promotion (urgent_boost / spotlight) applies to — same
  // metadata channel (PRD §5.2/§18.3).
  const jobId = params?.jobId || null;

  const [phase, setPhase] = useState("idle"); // idle | pushing | waiting | success | failed
  const [formError, setFormError] = useState("");
  const [txn, setTxn] = useState(null);
  const [pollLeft, setPollLeft] = useState(POLL_MAX_ATTEMPTS);

  const pollTimer = useRef(null);
  const attemptsRef = useRef(0);

  useEffect(() => {
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
    };
  }, []);

  function stopPolling() {
    if (pollTimer.current) {
      clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
  }

  async function handlePay() {
    setFormError("");
    setPhase("pushing");

    try {
      const metadata = {};
      if (WORKER_SCOPED.has(planId) && workerId) metadata.workerId = workerId;
      if (jobId && (planId === "urgent_boost" || planId === "spotlight")) {
        metadata.jobId = jobId;
      }

      const data = await startStkPush(
        planId,
        Object.keys(metadata).length > 0 ? metadata : undefined
      );

      setTxn({ id: data.txnId });
      setPollLeft(POLL_MAX_ATTEMPTS);
      attemptsRef.current = 0;
      setPhase("waiting");
      startPolling(data.txnId);
    } catch (error) {
      setFormError(error?.message || "Could not start the M-Pesa request.");
      setPhase("idle");
    }
  }

  function startPolling(txnId) {
    stopPolling();

    pollTimer.current = setInterval(async () => {
      attemptsRef.current += 1;
      setPollLeft(POLL_MAX_ATTEMPTS - attemptsRef.current);

      if (attemptsRef.current >= POLL_MAX_ATTEMPTS) {
        stopPolling();
        setFormError(
          "We haven't received a confirmation yet. If you entered your PIN, check your M-Pesa message — you can safely close and retry."
        );
        setPhase("failed");
        return;
      }

      try {
        const data = await getTransaction(txnId);
        const status = data.transaction?.status;

        if (status === "success") {
          stopPolling();
          setTxn(data.transaction);
          setPhase("success");
        } else if (status === "failed") {
          stopPolling();
          setTxn(data.transaction);
          setFormError(
            data.transaction.resultDesc ||
              "The payment did not go through. No money was deducted for a cancelled request."
          );
          setPhase("failed");
        }
        // 'pending' and 'timeout' keep polling.
      } catch (error) {
        // Transient network errors during polling are not fatal — next tick retries.
      }
    }, POLL_INTERVAL_MS);
  }

  function handleCancel() {
    stopPolling();
    navigation.goBack();
  }

  function handleRetry() {
    setTxn(null);
    setFormError("");
    setPhase("idle");
  }

  const busy = phase === "pushing";
  const stepIndex = phase === "waiting" || phase === "failed" ? 1 : 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.cream} />

      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={handleCancel}
          hitSlop={10}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
        >
          <TabBarIcon name="chevron-left" color={colors.ink} size={22} />
        </Pressable>
        <Text style={styles.headerTitle}>M-Pesa</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.centerWrap}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {phase === "success" ? (
          <View style={styles.phaseWrap}>
            <View style={[styles.successBadge, styles.cardShadow]}>
              <TabBarIcon name="check" color={colors.white} size={30} />
            </View>
            <StatusPill tone="success" label="Success" />
            <Text style={styles.successTitle}>Payment received</Text>
            <Text style={styles.successText}>
              {txn?.mpesaReceipt
                ? `M-Pesa receipt ${txn.mpesaReceipt} · KES ${txn.amountKes}`
                : `KES ${txn?.amountKes ?? meta.amountKes} received`}
            </Text>
            {planId === "contact_unlock" ? (
              <Text style={styles.successHint}>
                Contact details are now unlocked on worker profiles. Go back to
                see them.
              </Text>
            ) : planId === "chat_pass" ? (
              <Text style={styles.successHint}>
                Your conversation is open — go back and tap Chat to start
                talking.
              </Text>
            ) : planId === "job_post" ? (
              <Text style={styles.successHint}>
                Your post credit is ready. Head back to publish the job, then
                manage responses under My Jobs.
              </Text>
            ) : planId === "hire_pass" ? (
              <Text style={styles.successHint}>
                Hire Pass active for 14 days — 5 chats and 1 job post. Every
                extra chat unlocks instantly.
              </Text>
            ) : planId === "emp_basic" || planId === "emp_gold" ? (
              <Text style={styles.successHint}>
                {planId === "emp_gold" ? "Gold" : "Basic"} is active for 7
                days — chats and job posts are covered. Your balance updates
                on the home screen.
              </Text>
            ) : planId === "apply_pass" ? (
              <Text style={styles.successHint}>
                Application credit ready — go back and apply. Unused credits
                keep for 90 days.
              </Text>
            ) : planId === "maid_basic" || planId === "maid_gold" ? (
              <Text style={styles.successHint}>
                {planId === "maid_gold" ? "Gold" : "Basic"} is active for 7
                days — your applications are refilled. Employers see verified
                applicants first.
              </Text>
            ) : PLAN_META[planId] ? (
              <Text style={styles.successHint}>
                Unlimited chats and job posts are active for the next
                {planId === "chat_week" ? " 7 days" : " 30 days"}. Any maid's
                Chat button opens straight away.
              </Text>
            ) : (
              <Text style={styles.successHint}>
                Thanks for confirming M-Pesa works end to end.
              </Text>
            )}
            <Pressable
              android_ripple={{ color: withAlpha(colors.brand, 0.08) }}
              style={({ pressed }) => [
                styles.button,
                styles.buttonPrimary,
                pressed && styles.pressed,
              ]}
              onPress={handleCancel}
            >
              <Text style={styles.buttonPrimaryText}>Done</Text>
            </Pressable>
          </View>
        ) : phase === "waiting" ? (
          <View style={styles.phaseWrap}>
            <View style={[styles.waitingBadge, styles.cardShadow]}>
              <ActivityIndicator size="large" color={colors.brand} />
            </View>
            <StatusPill tone="pending" label="Pending" />
            <Text style={styles.waitingTitle}>Check your phone</Text>
            <Text style={styles.waitingText}>
              An M-Pesa request for KES {meta.amountKes} was sent to{" "}
              {formatPhoneDisplay(user?.phone || "")}. Enter your M-Pesa PIN to
              complete the payment.
            </Text>
            <Text style={styles.waitingMeta}>
              Waiting for confirmation… {pollLeft > 0 ? `${pollLeft * 3}s` : ""}
            </Text>
            <StepTrail active={1} />
            <Pressable
              style={({ pressed }) => [styles.linkButton, pressed && styles.pressed]}
              onPress={handleCancel}
            >
              <Text style={styles.linkText}>Cancel</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.phaseWrap}>
            {phase === "failed" ? (
              <StatusPill tone="fail" label="Payment not completed" />
            ) : null}

            {/* ---- Amount hero ---- */}
            <View style={[styles.amountCard, styles.cardShadow]}>
              <View style={styles.amountBadge}>
                <TabBarIcon
                  name="credit-card"
                  color={colors.white}
                  size={19}
                />
              </View>
              <Text style={styles.amountLabel}>{label}</Text>
              <Text style={styles.amountValue}>KES {meta.amountKes}</Text>
            </View>

            {/* ---- Detail rows ---- */}
            <View style={styles.detailCard}>
              <View style={styles.detailRow}>
                <View
                  style={[
                    styles.detailIcon,
                    { backgroundColor: withAlpha(colors.brand, 0.08) },
                  ]}
                >
                  <TabBarIcon name="phone" color={colors.brand} size={15} />
                </View>
                <View style={styles.detailBody}>
                  <Text style={styles.detailLabel}>M-PESA NUMBER</Text>
                  <Text style={styles.detailValue}>
                    {formatPhoneDisplay(user?.phone || "")}
                  </Text>
                </View>
              </View>

              <View style={styles.detailDivider} />

              <View style={styles.detailRow}>
                <View
                  style={[
                    styles.detailIcon,
                    { backgroundColor: withAlpha(colors.gold, 0.14) },
                  ]}
                >
                  <TabBarIcon name="file-text" color={colors.goldDark} size={15} />
                </View>
                <View style={styles.detailBody}>
                  <Text style={styles.detailLabel}>PAYING FOR</Text>
                  <Text style={styles.detailValue}>{label}</Text>
                </View>
              </View>
            </View>

            <StepTrail active={stepIndex} failed={phase === "failed"} />

            <Text style={styles.explain}>
              We'll send an STK push to your HelpNest number{" "}
              <Text style={styles.explainBold}>
                {formatPhoneDisplay(user?.phone || "")}
              </Text>
              . Enter your M-Pesa PIN on the prompt to pay.
            </Text>

            {formError ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{formError}</Text>
              </View>
            ) : null}

            <Pressable
              accessibilityRole="button"
              android_ripple={{ color: withAlpha(colors.brand, 0.08) }}
              style={({ pressed }) => [
                styles.button,
                styles.buttonPrimary,
                pressed && styles.pressed,
                busy && styles.buttonBusy,
              ]}
              onPress={busy ? undefined : phase === "failed" ? handleRetry : handlePay}
              disabled={busy}
            >
              {busy ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.buttonPrimaryText}>
                  {phase === "failed" ? "Try again" : `Pay KES ${meta.amountKes}`}
                </Text>
              )}
            </Pressable>

            <View style={styles.trustRow}>
              <TabBarIcon name="lock" color={colors.textFaint} size={12} />
              <Text style={styles.trustText}>
                Secured by M-Pesa — you confirm with your PIN.
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/* ---------- Status pill (pending / success / fail) ---------- */
function StatusPill({ tone, label }) {
  const toneStyles = {
    pending: [styles.pillPending, styles.pillDotPending, styles.pillTextPending],
    success: [styles.pillSuccess, styles.pillDotSuccess, styles.pillTextSuccess],
    fail: [styles.pillFail, styles.pillDotFail, styles.pillTextFail],
  }[tone];

  return (
    <View style={[styles.pill, toneStyles[0]]}>
      <View style={[styles.pillDot, toneStyles[1]]} />
      <Text style={[styles.pillText, toneStyles[2]]}>{label}</Text>
    </View>
  );
}

/* ---------- 1 Request → 2 Enter PIN → 3 Confirm ---------- */
function StepTrail({ active, failed }) {
  return (
    <View style={styles.steps}>
      {STEPS.map((label, i) => {
        const done = i < active;
        const current = i === active;

        return (
          <React.Fragment key={label}>
            {i > 0 ? (
              <View
                style={[styles.stepLine, done && styles.stepLineDone]}
              />
            ) : null}

            <View style={styles.stepItem}>
              <View
                style={[
                  styles.stepDot,
                  done && styles.stepDotDone,
                  current && !failed && styles.stepDotActive,
                  current && failed && styles.stepDotFail,
                ]}
              >
                {done ? (
                  <TabBarIcon name="check" color={colors.brand} size={12} />
                ) : (
                  <Text
                    style={[
                      styles.stepNum,
                      current && !failed && styles.stepNumActive,
                      current && failed && styles.stepNumFail,
                    ]}
                  >
                    {i + 1}
                  </Text>
                )}
              </View>
              <Text
                style={[
                  styles.stepLabel,
                  done && styles.stepLabelDone,
                  current && !failed && styles.stepLabelActive,
                  current && failed && styles.stepLabelFail,
                ]}
              >
                {label}
              </Text>
            </View>
          </React.Fragment>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.cream,
  },

  /* ---- Header ---- */
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    color: colors.ink,
    fontSize: 17.5,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  backButton: {
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
  headerSpacer: {
    width: 42,
  },
  pressed: {
    opacity: 0.88,
  },

  /* ---- Body ---- */
  body: {
    flex: 1,
  },
  centerWrap: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  phaseWrap: {
    alignItems: "center",
    width: "100%",
  },
  cardShadow: {
    shadowColor: colors.ink,
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 1,
  },

  /* ---- Amount hero ---- */
  amountCard: {
    width: "100%",
    backgroundColor: colors.brand,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: withAlpha(colors.white, 0.16),
    padding: 24,
    alignItems: "center",
    marginBottom: 14,
  },
  amountBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: withAlpha(colors.white, 0.16),
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  amountLabel: {
    color: withAlpha(colors.white, 0.8),
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 6,
    textAlign: "center",
  },
  amountValue: {
    color: colors.white,
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: -0.6,
  },

  /* ---- Detail rows ---- */
  detailCard: {
    width: "100%",
    backgroundColor: colors.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.mist,
    paddingVertical: 4,
    marginBottom: 20,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  detailIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  detailBody: {
    flex: 1,
  },
  detailLabel: {
    color: colors.goldDark,
    fontSize: 10.5,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  detailValue: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "600",
    marginTop: 3,
  },
  detailDivider: {
    height: 1,
    backgroundColor: colors.mist,
    marginHorizontal: 16,
  },

  /* ---- Step trail ---- */
  steps: {
    flexDirection: "row",
    alignItems: "flex-start",
    width: "100%",
    marginBottom: 20,
  },
  stepItem: {
    alignItems: "center",
    paddingHorizontal: 2,
  },
  stepDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.mist,
    alignItems: "center",
    justifyContent: "center",
  },
  stepDotDone: {
    backgroundColor: withAlpha(colors.brand, 0.14),
  },
  stepDotActive: {
    backgroundColor: colors.brand,
  },
  stepDotFail: {
    backgroundColor: withAlpha(colors.danger, 0.12),
  },
  stepNum: {
    color: colors.textFaint,
    fontSize: 12,
    fontWeight: "800",
  },
  stepNumActive: {
    color: colors.white,
  },
  stepNumFail: {
    color: colors.danger,
  },
  stepLabel: {
    color: colors.textFaint,
    fontSize: 10.5,
    fontWeight: "700",
    marginTop: 6,
  },
  stepLabelDone: {
    color: colors.textMuted,
  },
  stepLabelActive: {
    color: colors.ink,
    fontWeight: "800",
  },
  stepLabelFail: {
    color: colors.danger,
    fontWeight: "800",
  },
  stepLine: {
    flex: 1,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.mist,
    marginHorizontal: 6,
    marginTop: 12,
  },
  stepLineDone: {
    backgroundColor: withAlpha(colors.brand, 0.35),
  },

  /* ---- Copy ---- */
  explain: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    marginBottom: 20,
  },
  explainBold: {
    color: colors.ink,
    fontWeight: "800",
  },
  errorBox: {
    backgroundColor: withAlpha(colors.danger, 0.08),
    borderRadius: 14,
    borderWidth: 1,
    borderColor: withAlpha(colors.danger, 0.18),
    padding: 14,
    marginBottom: 16,
    width: "100%",
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "700",
    textAlign: "center",
  },

  /* ---- Buttons / links ---- */
  button: {
    minHeight: 54,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  buttonPrimary: {
    backgroundColor: colors.brand,
    shadowColor: colors.ink,
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 1,
  },
  buttonBusy: {
    opacity: 0.7,
  },
  buttonPrimaryText: {
    color: colors.white,
    fontSize: 15.5,
    fontWeight: "800",
  },
  trustRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 14,
  },
  trustText: {
    color: colors.textFaint,
    fontSize: 11.5,
    fontWeight: "600",
  },
  linkButton: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    marginTop: 18,
  },
  linkText: {
    color: colors.brand,
    fontSize: 14,
    fontWeight: "800",
  },

  /* ---- Waiting ---- */
  waitingBadge: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.mist,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  waitingTitle: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: "800",
    marginTop: 14,
    marginBottom: 8,
  },
  waitingText: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    marginBottom: 10,
  },
  waitingMeta: {
    color: colors.textFaint,
    fontSize: 12.5,
    fontWeight: "700",
    marginBottom: 18,
  },

  /* ---- Success ---- */
  successBadge: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  successTitle: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: "800",
    marginTop: 14,
    marginBottom: 6,
  },
  successText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 10,
  },
  successHint: {
    color: colors.textMuted,
    fontSize: 13.5,
    lineHeight: 20,
    textAlign: "center",
    marginBottom: 24,
  },

  /* ---- Status pill ---- */
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  pillPending: {
    backgroundColor: withAlpha(colors.gold, 0.14),
  },
  pillSuccess: {
    backgroundColor: withAlpha(colors.brand, 0.12),
  },
  pillFail: {
    backgroundColor: withAlpha(colors.danger, 0.1),
  },
  pillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  pillDotPending: {
    backgroundColor: colors.gold,
  },
  pillDotSuccess: {
    backgroundColor: colors.brandSoft,
  },
  pillDotFail: {
    backgroundColor: colors.danger,
  },
  pillText: {
    fontSize: 11.5,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  pillTextPending: {
    color: colors.goldDark,
  },
  pillTextSuccess: {
    color: colors.brand,
  },
  pillTextFail: {
    color: colors.danger,
  },
});
