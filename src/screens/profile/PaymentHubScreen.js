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
        {/* =====================================================
            Sage hero — compact, with M-Pesa badge.
            ===================================================== */}
        <View style={styles.heroPanel}>
          <View style={styles.orb1} />
          <View style={styles.orb2} />

          <View style={styles.heroTopRow}>
            <View style={styles.heroIconChip}>
              <TabBarIcon
                name="credit-card"
                color={colors.brand}
                size={20}
              />
            </View>
            <View style={styles.mpesaBadge}>
              <View style={styles.mpesaDot} />
              <Text style={styles.mpesaBadgeText}>M-PESA · STK</Text>
            </View>
          </View>

          <Text style={styles.heroTitle}>Wallet & payments</Text>
          <Text style={styles.heroBody}>
            Tap a plan below and the request goes straight to your phone as an
            M-Pesa STK push. No card numbers, no PINs typed here.
          </Text>
        </View>

        {/* =====================================================
            Chapter 01 — PAY: available plans.
            ===================================================== */}
        <View style={styles.chapterHead}>
          <Text style={styles.chapterNum}>01</Text>
          <View style={styles.chapterMain}>
            <Text style={styles.chapterEyebrow}>PAY</Text>
            <Text style={styles.chapterTitle}>Available plans</Text>
          </View>
        </View>

        {plans.map((plan) => (
          <View key={plan.id} style={styles.planCard}>
            <View
              style={[
                styles.planAccent,
                plan.highlight && styles.planAccentGold,
              ]}
            />
            <View style={styles.planBody}>
              <View style={styles.planHeadRow}>
                <View
                  style={[
                    styles.planIcon,
                    plan.highlight && styles.planIconGold,
                  ]}
                >
                  <TabBarIcon
                    name={plan.icon}
                    color={plan.highlight ? colors.goldDark : colors.brand}
                    size={18}
                  />
                </View>
                <View style={styles.planTitleBlock}>
                  <Text style={styles.planLabel} numberOfLines={1}>
                    {plan.label}
                  </Text>
                  <Text style={styles.planAmount}>
                    KES {plan.amountKes}
                  </Text>
                </View>
                {plan.highlight ? (
                  <View style={styles.planPill}>
                    <Text style={styles.planPillText}>TEST</Text>
                  </View>
                ) : null}
              </View>

              <Text style={styles.planBlurb}>{plan.blurb}</Text>

              <Pressable
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.planCta,
                  plan.highlight && styles.planCtaGold,
                  pressed && styles.pressed,
                ]}
                onPress={() =>
                  navigation.navigate("MpesaCheckout", {
                    plan: plan.id,
                    label: plan.label,
                  })
                }
                android_ripple={{
                  color: plan.highlight
                    ? withAlpha(colors.ink, 0.08)
                    : withAlpha(colors.white, 0.14),
                }}
              >
                <Text
                  style={[
                    styles.planCtaText,
                    plan.highlight && styles.planCtaTextGold,
                  ]}
                  numberOfLines={1}
                >
                  {plan.cta}
                </Text>
                <View
                  style={[
                    styles.planCtaArrow,
                    plan.highlight && styles.planCtaArrowGold,
                  ]}
                >
                  <TabBarIcon
                    name="arrow-right"
                    color={plan.highlight ? colors.ink : colors.white}
                    size={13}
                  />
                </View>
              </Pressable>
            </View>
          </View>
        ))}

        {/* =====================================================
            Chapter 02 — STATEMENT: purchases & refunds.
            ===================================================== */}
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
          <Pressable
            style={styles.refundSheetBackdrop}
            onPress={() => setRefundFor(null)}
          />
          <View style={styles.refundSheet}>
            <View style={styles.refundGrabber} />
            <Text style={styles.refundSheetTitle}>Request a refund</Text>
            {refundFor ? (
              <Text style={styles.refundSheetSub}>
                {refundFor.planLabel || refundFor.plan} · KES{" "}
                {refundFor.amountKes}
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
    <>
      <View style={styles.chapterHead}>
        <Text style={styles.chapterNum}>02</Text>
        <View style={styles.chapterMain}>
          <Text style={styles.chapterEyebrow}>STATEMENT</Text>
          <Text style={styles.chapterTitle}>Purchases & refunds</Text>
        </View>
        <Pressable
          onPress={onRefresh}
          hitSlop={8}
          style={({ pressed }) => [
            styles.refreshBtn,
            pressed && styles.pressed,
          ]}
        >
          <TabBarIcon name="refresh-cw" color={colors.brand} size={11} />
          <Text style={styles.refreshText}>Refresh</Text>
        </Pressable>
      </View>

      <View style={styles.statementCard}>
        {history.slice(0, 8).map((t) => {
          const refundLabel = REFUND_LABEL[t.refundStatus || "none"];
          const success = t.status === "success";
          const failed = t.status === "failed";
          const pending =
            t.status === "pending" || t.status === "timeout";
          const canRefund = success && (t.refundStatus || "none") === "none";

          const sub =
            success
              ? `Paid · ${t.unitsGranted > 0 ? `${t.unitsGranted} credit${t.unitsGranted === 1 ? "" : "s"}` : "recorded"}`
              : pending
              ? t.status === "timeout"
                ? "Outcome unknown"
                : "Awaiting payment"
              : "Payment failed";

          return (
            <View key={t.id} style={styles.statementRow}>
              <View
                style={[
                  styles.statementDot,
                  success && styles.statementDotOk,
                  pending && styles.statementDotPending,
                  failed && styles.statementDotFail,
                ]}
              />
              <View style={styles.statementMain}>
                <Text style={styles.statementTitle} numberOfLines={1}>
                  {t.planLabel || t.plan}
                </Text>
                <Text style={styles.statementSub} numberOfLines={1}>
                  {sub}
                  {refundLabel ? ` · ${refundLabel}` : ""}
                </Text>
              </View>
              <View style={styles.statementRight}>
                <Text style={styles.statementAmount}>
                  KES {t.amountKes}
                </Text>
                {canRefund ? (
                  <Pressable
                    accessibilityRole="button"
                    style={({ pressed }) => [
                      styles.helpLink,
                      pressed && styles.pressed,
                    ]}
                    onPress={() => onRequestRefund(t)}
                    android_ripple={{
                      color: withAlpha(colors.brand, 0.08),
                    }}
                  >
                    <Text style={styles.helpLinkText}>Get help</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          );
        })}
      </View>
    </>
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
    paddingBottom: 32,
  },
  pressed: {
    opacity: 0.88,
  },

  /* ============================================================
     Sage hero — compact with M-Pesa badge.
     ============================================================ */
  heroPanel: {
    backgroundColor: colors.mist,
    marginHorizontal: -20,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 20,
    marginBottom: 20,
    overflow: "hidden",
  },
  orb1: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: withAlpha(colors.brand, 0.09),
    top: -100,
    right: -60,
  },
  orb2: {
    position: "absolute",
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: withAlpha(colors.gold, 0.16),
    bottom: -50,
    left: -50,
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
  mpesaBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.white,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: withAlpha(colors.ink, 0.06),
  },
  mpesaDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.brandSoft,
  },
  mpesaBadgeText: {
    color: colors.ink,
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
    marginBottom: 6,
  },
  heroBody: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "500",
  },

  /* ============================================================
     Chapter heads.
     ============================================================ */
  chapterHead: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginTop: 4,
    marginBottom: 12,
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
     Plan cards — bookmark-ribbon accent bar on the left.
     ============================================================ */
  planCard: {
    flexDirection: "row",
    backgroundColor: colors.white,
    borderRadius: 18,
    overflow: "hidden",
    marginBottom: 12,
    shadowColor: colors.ink,
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  planAccent: {
    width: 3,
    backgroundColor: colors.brand,
  },
  planAccentGold: {
    backgroundColor: colors.gold,
  },
  planBody: {
    flex: 1,
    padding: 16,
  },
  planHeadRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    gap: 10,
  },
  planIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: withAlpha(colors.brand, 0.1),
    alignItems: "center",
    justifyContent: "center",
  },
  planIconGold: {
    backgroundColor: withAlpha(colors.gold, 0.18),
  },
  planTitleBlock: {
    flex: 1,
  },
  planLabel: {
    color: colors.ink,
    fontSize: 14.5,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  planAmount: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
    letterSpacing: 0.1,
  },
  planPill: {
    backgroundColor: withAlpha(colors.gold, 0.18),
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  planPillText: {
    color: colors.goldDark,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  planBlurb: {
    color: colors.textMuted,
    fontSize: 12.5,
    lineHeight: 18,
    fontWeight: "500",
    marginBottom: 14,
  },

  /* ---- Plan CTA ---- */
  planCta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    backgroundColor: colors.brand,
    borderRadius: 12,
    minHeight: 44,
    paddingLeft: 14,
    paddingRight: 5,
    paddingVertical: 5,
    overflow: "hidden",
  },
  planCtaGold: {
    backgroundColor: colors.gold,
  },
  planCtaText: {
    flex: 1,
    color: colors.white,
    fontSize: 13.5,
    fontWeight: "800",
    letterSpacing: -0.1,
  },
  planCtaTextGold: {
    color: colors.ink,
  },
  planCtaArrow: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: withAlpha(colors.white, 0.16),
    alignItems: "center",
    justifyContent: "center",
  },
  planCtaArrowGold: {
    backgroundColor: withAlpha(colors.ink, 0.12),
  },

  /* ============================================================
     Statement card — bank-statement layout with status dots.
     ============================================================ */
  statementCard: {
    backgroundColor: colors.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: withAlpha(colors.ink, 0.05),
    paddingHorizontal: 14,
    paddingVertical: 4,
    marginBottom: 14,
    shadowColor: colors.ink,
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  statementRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: withAlpha(colors.ink, 0.05),
  },
  statementRow_first: {
    borderTopWidth: 0,
  },
  statementDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.mistDark,
  },
  statementDotOk: {
    backgroundColor: colors.brandSoft,
  },
  statementDotPending: {
    backgroundColor: colors.gold,
  },
  statementDotFail: {
    backgroundColor: colors.danger,
  },
  statementMain: {
    flex: 1,
  },
  statementTitle: {
    color: colors.ink,
    fontSize: 13.5,
    fontWeight: "700",
    letterSpacing: -0.1,
  },
  statementSub: {
    color: colors.textMuted,
    fontSize: 11.5,
    fontWeight: "500",
    marginTop: 2,
  },
  statementRight: {
    alignItems: "flex-end",
    gap: 4,
  },
  statementAmount: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  helpLink: {
    backgroundColor: withAlpha(colors.gold, 0.16),
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    overflow: "hidden",
  },
  helpLinkText: {
    color: colors.goldDark,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.2,
  },

  refreshBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: withAlpha(colors.brand, 0.08),
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    overflow: "hidden",
    marginBottom: 4,
  },
  refreshText: {
    color: colors.brand,
    fontSize: 10.5,
    fontWeight: "800",
    letterSpacing: 0.2,
  },

  /* ============================================================
     Refund sheet.
     ============================================================ */
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
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  refundSheetSub: {
    color: colors.brand,
    fontSize: 13,
    fontWeight: "700",
    marginTop: 4,
    letterSpacing: 0.1,
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
    borderColor: withAlpha(colors.ink, 0.08),
    borderRadius: 14,
    backgroundColor: withAlpha(colors.ink, 0.04),
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
    fontSize: 14,
  },
  refundSheetBtnGhost: {
    backgroundColor: withAlpha(colors.ink, 0.06),
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
    fontSize: 11.5,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 6,
    lineHeight: 16,
  },
});