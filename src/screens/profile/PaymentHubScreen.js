import React from "react";
import { Pressable, StatusBar, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";

import HamburgerButton from "../../components/ui/HamburgerButton";
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
    highlight: true,
  },
  {
    id: "contact_unlock",
    label: "Contact unlock",
    amountKes: 300,
    blurb:
      "Reveal a worker's phone number to arrange interviews directly. One unlock reveals contacts across HelpNest while this MVP pricing holds.",
    cta: "Unlock contacts",
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
        <Text style={styles.title}>Payments</Text>
        <Text style={styles.subtitle}>
          Pay via M-Pesa STK push — the request goes straight to your phone.
        </Text>

        {PLANS.map((plan) => (
          <View key={plan.id} style={styles.planCard}>
            <View style={styles.planHead}>
              <Text style={styles.planLabel}>{plan.label}</Text>
              <Text style={styles.planAmount}>KES {plan.amountKes}</Text>
            </View>
            <Text style={styles.planBlurb}>{plan.blurb}</Text>

            <Pressable
              accessibilityRole="button"
              style={[
                styles.planButton,
                plan.highlight && styles.planButtonPrimary,
              ]}
              onPress={() =>
                navigation.navigate("MpesaCheckout", {
                  plan: plan.id,
                  label: plan.label,
                })
              }
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
    paddingHorizontal: 16,
    paddingTop: 2,
  },
  body: {
    flex: 1,
    padding: 22,
  },
  title: {
    color: colors.ink,
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 13.5,
    lineHeight: 20,
    marginTop: 6,
    marginBottom: 18,
  },
  planCard: {
    backgroundColor: colors.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.mist,
    padding: 18,
    marginBottom: 14,
  },
  planHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  planLabel: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "800",
    flex: 1,
    marginRight: 10,
  },
  planAmount: {
    color: colors.brand,
    fontSize: 16,
    fontWeight: "800",
  },
  planBlurb: {
    color: colors.textMuted,
    fontSize: 12.5,
    lineHeight: 19,
    marginBottom: 14,
  },
  planButton: {
    borderWidth: 1,
    borderColor: colors.brand,
    borderRadius: 12,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  planButtonPrimary: {
    backgroundColor: colors.brand,
  },
  planButtonText: {
    color: colors.brand,
    fontSize: 13.5,
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
    marginTop: 8,
  },
});
