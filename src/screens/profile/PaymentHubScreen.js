import React from "react";
import { Pressable, StatusBar, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";

import HamburgerButton from "../../components/ui/HamburgerButton";
import TabBarIcon from "../../components/ui/TabBarIcon";
import { colors, withAlpha } from "../../theme/colors";

// Subscription & payments hub for employers (PRD §7/§11). Real plan
// pricing is still to be finalised — the KES 1 test plan exists so the
// M-Pesa STK flow can be verified end to end on a real phone.
const PLANS = [
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

export default function PaymentHubScreen() {
  const navigation = useNavigation();

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.cream} />

      <View style={styles.menuRow}>
        <HamburgerButton />
      </View>

      <View style={styles.body}>
        <Text style={styles.eyebrow}>Billing</Text>
        <Text style={styles.title}>Payments</Text>
        <Text style={styles.subtitle}>
          Pay via M-Pesa STK push — the request goes straight to your phone.
        </Text>

        {PLANS.map((plan) => (
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

        <Text style={styles.footnote}>
          Monthly subscription pricing is being finalised and will appear here.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  menuRow: {
    paddingHorizontal: 20,
    paddingTop: 4,
  },
  body: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 24,
  },
  pressed: {
    opacity: 0.88,
  },
  eyebrow: {
    color: colors.goldDark,
    fontSize: 10.5,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  title: {
    color: colors.ink,
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 6,
    marginBottom: 22,
  },
  planCard: {
    backgroundColor: colors.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.mist,
    padding: 18,
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
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: withAlpha(colors.brand, 0.1),
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  planIconGold: {
    backgroundColor: withAlpha(colors.gold, 0.18),
  },
  planLabel: {
    color: colors.ink,
    fontSize: 16,
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
    fontSize: 13,
    lineHeight: 19,
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
    fontSize: 14,
    fontWeight: "800",
  },
  planButtonTextPrimary: {
    color: colors.white,
  },
  footnote: {
    color: colors.textFaint,
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 10,
  },
});
