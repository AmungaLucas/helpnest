import React, { useCallback, useState } from "react";
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

import { useAuth } from "../../context/AuthContext";
import { fetchHistory, requestRefund } from "../../services/paymentsService";
import ScreenHeader from "../../components/ui/ScreenHeader";
import TabBarIcon from "../../components/ui/TabBarIcon";
import { colors, withAlpha } from "../../theme/colors";

// Subscription & payments hub (PRD §7/§11/§14.7). Both roles land here
// from the profile drawer. Plan pricing is still being finalised — the
// KES 1 test plan exists so the M-Pesa STK flow can be verified end to
// end on a real phone. Purchases & refunds moved here from the profile
// overview ("Billing") so all money matters live in one place.
const SHARED_PLANS = [
  {
    id: "test_kes1",
    label: "M-Pesa test payment",
    amountKes: 1,
    blurb:
      "One-shilling end-to-end check of the STK flow — nothing is billed to anyone when testing.",
    cta: "Send test STK push",
    icon: "zap",
    highlight: true,
  },
];

const EMPLOYER_PLANS = [
  ...SHARED_PLANS,
  {
    id: "contact_unlock",
    label: "Contact unlock",
    amountKes: 300,
    blurb:
      "Reveal a worker's phone number to arrange interviews directly. One unlock reveals contacts across HelpNest while this MVP pricing holds.",
    cta: "Unlock contacts",
    icon: "key",
    highlight: false,
  },
];

const MAID_PLANS = [
  ...SHARED_PLANS,
  {
    id: "profile_boost",
    label: "Profile boost — 7 days featured",
    amountKes: 100,
    blurb:
      "Get a labeled “Featured” placement at the top of employer searches for 7 days. Placement is labeled, never a guaranteed position.",
    cta: "Boost my profile",
    icon: "zap",
    highlight: false,
  },
];

const REFUND_LABEL = {
  none: null,
  requested: "refund requested",
  approved: "refund approved",
  completed: "refunded",
  rejected: "refund declined",
};

export default function PaymentHubScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const plans = user?.role === "maid" ? MAID_PLANS : EMPLOYER_PLANS;

  // Purchase history (PRD §14.7) + refund request action (§14.3 manual
  // flow). Silent failure: the section just stays hidden if the API hiccups.
  const [history, setHistory] = useState(null);
  const [refundFor, setRefundFor] = useState(null); // txn row awaiting a reason
  const [refundReason, setRefundReason] = useState("");
  const [refundBusy, setRefundBusy] = useState(false);

  const loadHistory = useCallback(() => {
    fetchHistory()
      .then((d) => setHistory(d.history || []))
      .catch(() => setHistory(null));
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [loadHistory])
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

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.cream} />

      <ScreenHeader
        leading="hamburger"
        eyebrow="Billing"
        title="Subscription & payments"
        tone="canvas"
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.subtitle}>
          Pay via M-Pesa STK push — the request goes straight to your phone.
        </Text>

        {plans.map((plan) => (
          <View
            key={plan.id}
            style={[styles.planCard, plan.highlight && styles.planCardHighlight]}
          >
            <View style={styles.planHead}>
              <View
                style={[
                  styles.planIcon,
                  plan.highlight && styles.planIconGold,
                ]}
              >
                <TabBarIcon
                  name={plan.icon}
                  color={plan.highlight ? colors.goldDark : colors.brand}
                  size={20}
                />
              </View>
              <Text style={styles.planLabel}>{plan.label}</Text>
              <Text style={styles.planAmount}>KES {plan.amountKes}</Text>
            </View>
            <Text style={styles.planBlurb}>{plan.blurb}</Text>

            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.planButton,
                plan.highlight && styles.planButtonPrimary,
                pressed && styles.pressed,
              ]}
              onPress={() =>
                navigation.navigate("MpesaCheckout", {
                  plan: plan.id,
                  label: plan.label,
                })
              }
              android_ripple={{ color: withAlpha(colors.brand, 0.08) }}
            >
              <Text
                style={[
                  styles.planButtonText,
                  plan.highlight && styles.planButtonTextPrimary,
                ]}
              >
                {plan.cta}
              </Text>
            </Pressable>
          </View>
        ))}

        <PurchasesCard
          history={history}
          onRefresh={loadHistory}
          onRequestRefund={(txn) => {
            setRefundFor(txn);
            setRefundReason("");
          }}
        />

        <Text style={styles.footnote}>
          Monthly subscription pricing is being finalised and will appear here.
        </Text>
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

// Purchases & refunds (PRD §14.7): recent payments with their outcome plus
// the per-transaction "Get help" action. Money moves stay manual on our
// side — this card only files and tracks the request.
function PurchasesCard({ history, onRefresh, onRequestRefund }) {
  if (!history || history.length === 0) return null;

  return (
    <View style={[styles.planCard, styles.purchasesCard]}>
      <View style={styles.planHead}>
        <View style={styles.planIcon}>
          <TabBarIcon name="file-text" color={colors.brand} size={20} />
        </View>
        <View style={styles.purchasesMain}>
          <Text style={styles.purchasesEyebrow}>Purchases</Text>
          <Text style={styles.purchasesTitle}>Purchases & refunds</Text>
        </View>
        <Pressable
          onPress={onRefresh}
          hitSlop={8}
          style={({ pressed }) => [
            styles.refreshBtn,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.refreshText}>Refresh</Text>
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
                style={({ pressed }) => [
                  styles.refundBtn,
                  pressed && styles.pressed,
                ]}
                onPress={() => onRequestRefund(t)}
                android_ripple={{ color: withAlpha(colors.brand, 0.08) }}
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

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 2,
    paddingBottom: 28,
  },
  pressed: {
    opacity: 0.88,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 20,
  },
  planCard: {
    backgroundColor: colors.white,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.mist,
    padding: 20,
    marginBottom: 16,
    shadowColor: colors.ink,
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 1,
  },
  planCardHighlight: {
    borderColor: withAlpha(colors.gold, 0.55),
  },
  planHead: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  planIcon: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: withAlpha(colors.brand, 0.1),
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  planIconGold: {
    backgroundColor: withAlpha(colors.gold, 0.18),
    borderWidth: 1,
    borderColor: withAlpha(colors.gold, 0.45),
  },
  planLabel: {
    color: colors.ink,
    fontSize: 17.5,
    fontWeight: "800",
    flex: 1,
    marginRight: 10,
  },
  planAmount: {
    color: colors.brand,
    fontSize: 17,
    fontWeight: "800",
  },
  planBlurb: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 16,
  },
  planButton: {
    borderWidth: 1,
    borderColor: colors.brand,
    borderRadius: 14,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    overflow: "hidden",
  },
  planButtonPrimary: {
    backgroundColor: colors.brand,
  },
  planButtonText: {
    color: colors.brand,
    fontSize: 15,
    fontWeight: "800",
  },
  planButtonTextPrimary: {
    color: colors.white,
  },
  purchasesCard: {
    marginTop: 8,
  },
  purchasesMain: {
    flex: 1,
    marginRight: 10,
  },
  purchasesEyebrow: {
    color: colors.goldDark,
    fontSize: 10.5,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 3,
  },
  purchasesTitle: {
    color: colors.ink,
    fontSize: 17.5,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  refreshBtn: {
    backgroundColor: withAlpha(colors.brand, 0.08),
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
    overflow: "hidden",
  },
  refreshText: {
    color: colors.brand,
    fontSize: 11.5,
    fontWeight: "800",
  },
  purchaseRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 56,
    paddingVertical: 9,
  },
  purchaseMain: {
    flex: 1,
    marginRight: 10,
  },
  purchaseTitle: {
    color: colors.ink,
    fontSize: 13.5,
    fontWeight: "700",
  },
  purchaseSub: {
    color: colors.textMuted,
    fontSize: 11.5,
    marginTop: 3,
  },
  refundBtn: {
    backgroundColor: withAlpha(colors.gold, 0.16),
    borderRadius: 10,
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
    marginBottom: 16,
  },
  refundSheetTitle: {
    color: colors.ink,
    fontSize: 19,
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
    fontSize: 12.5,
    lineHeight: 18,
    marginTop: 8,
    marginBottom: 14,
  },
  refundSheetInput: {
    borderWidth: 1,
    borderColor: colors.mistDark,
    borderRadius: 16,
    backgroundColor: colors.cream,
    padding: 14,
    minHeight: 90,
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
    minHeight: 48,
    paddingHorizontal: 20,
    minWidth: 110,
    alignItems: "center",
    justifyContent: "center",
  },
  refundSheetBtnText: {
    color: colors.white,
    fontWeight: "800",
    fontSize: 15,
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
  footnote: {
    color: colors.textFaint,
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 10,
  },
});
