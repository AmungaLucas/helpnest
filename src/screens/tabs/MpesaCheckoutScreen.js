import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
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

// Display-only mirror of the server-side plan catalog (amounts are still
// looked up server-side at push time).
const PLAN_META = {
  test_kes1: { label: "M-Pesa test payment", amountKes: 1 },
  contact_unlock: { label: "Unlock a worker's contact", amountKes: 300 },
};

const POLL_INTERVAL_MS = 3000;
const POLL_MAX_ATTEMPTS = 40; // ~2 minutes

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
      const data = await startStkPush(
        planId,
        planId === "contact_unlock" && workerId ? { workerId } : undefined
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.cream} />

      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={handleCancel}
          hitSlop={10}
          style={styles.backButton}
        >
          <TabBarIcon name="chevron-left" color={colors.ink} size={23} />
        </Pressable>
        <Text style={styles.headerTitle}>M-Pesa</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.body}>
        {phase === "success" ? (
          <View style={styles.centerWrap}>
            <View style={styles.successBadge}>
              <Text style={styles.successTick}>✓</Text>
            </View>
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
            ) : (
              <Text style={styles.successHint}>
                Thanks for confirming M-Pesa works end to end.
              </Text>
            )}
            <Pressable style={[styles.button, styles.buttonPrimary]} onPress={handleCancel}>
              <Text style={styles.buttonPrimaryText}>Done</Text>
            </Pressable>
          </View>
        ) : phase === "waiting" ? (
          <View style={styles.centerWrap}>
            <ActivityIndicator size="large" color={colors.brand} />
            <Text style={styles.waitingTitle}>Check your phone</Text>
            <Text style={styles.waitingText}>
              An M-Pesa request for KES {meta.amountKes} was sent to{" "}
              {formatPhoneDisplay(user?.phone || "")}. Enter your M-Pesa PIN to
              complete the payment.
            </Text>
            <Text style={styles.waitingMeta}>
              Waiting for confirmation… {pollLeft > 0 ? `${pollLeft * 3}s` : ""}
            </Text>
            <Pressable style={styles.linkButton} onPress={handleCancel}>
              <Text style={styles.linkText}>Cancel</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.centerWrap}>
            <View style={styles.amountCard}>
              <Text style={styles.amountLabel}>{label}</Text>
              <Text style={styles.amountValue}>KES {meta.amountKes}</Text>
            </View>

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
              style={[styles.button, styles.buttonPrimary, busy && styles.buttonBusy]}
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
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 22,
    paddingVertical: 14,
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    color: colors.ink,
    fontSize: 16,
    fontWeight: "800",
  },
  backButton: {
    width: 60,
    alignItems: "flex-start",
  },
  headerSpacer: {
    width: 60,
  },
  body: {
    flex: 1,
    padding: 22,
  },
  centerWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  amountCard: {
    width: "100%",
    backgroundColor: colors.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.mist,
    padding: 20,
    alignItems: "center",
    marginBottom: 18,
  },
  amountLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 6,
    textAlign: "center",
  },
  amountValue: {
    color: colors.ink,
    fontSize: 34,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  explain: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    marginBottom: 22,
  },
  explainBold: {
    color: colors.ink,
    fontWeight: "800",
  },
  errorBox: {
    backgroundColor: "#FFF0EE",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    width: "100%",
  },
  errorText: {
    color: "#7D2922",
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
  },
  button: {
    minHeight: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  buttonPrimary: {
    backgroundColor: colors.brand,
  },
  buttonBusy: {
    opacity: 0.7,
  },
  buttonPrimaryText: {
    color: colors.white,
    fontSize: 15.5,
    fontWeight: "800",
  },
  waitingTitle: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: "800",
    marginTop: 18,
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
    marginBottom: 24,
  },
  linkButton: {
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  linkText: {
    color: colors.brand,
    fontSize: 14,
    fontWeight: "800",
  },
  successBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: withAlpha(colors.brand, 0.14),
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  successTick: {
    color: colors.brand,
    fontSize: 30,
    fontWeight: "800",
  },
  successTitle: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 6,
  },
  successText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 10,
  },
  successHint: {
    color: colors.textMuted,
    fontSize: 13.5,
    lineHeight: 20,
    textAlign: "center",
    marginBottom: 24,
  },
});
