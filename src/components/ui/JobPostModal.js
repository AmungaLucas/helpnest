import React, { useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import TabBarIcon from "./TabBarIcon";
import { useNavigation } from "@react-navigation/native";
import { colors, withAlpha } from "../../theme/colors";

// Payment sheet shown when an employer submits a job without an active
// entitlement (the server answered 402). PRD §5.2 catalogue — pricing
// mirrors the server-side catalog (utils/catalog.js), display only:
//   job_post   KES 300 — publishes THIS listing (30 days)
//   hire_pass  KES 500 — 5 chats + 1 job post, 14 days
//   emp_basic  KES 499 — 3 chats + 3 job posts per 7 days
//   emp_gold   KES 899 — 7 chats + 5 job posts per 7 days
//
// "Continue" hands over to the M-Pesa checkout with the chosen plan; no
// workerId rides along (none of these plans is worker-scoped).
const PLAN_OPTIONS = [
  {
    id: "job_post",
    title: "Standard post",
    subtitle: "Publish this job for 30 days — pay once",
    price: 300,
  },
  {
    id: "hire_pass",
    title: "Hire Pass",
    subtitle: "5 chats + 1 job post · valid 14 days",
    price: 500,
  },
  {
    id: "emp_basic",
    title: "Basic · weekly",
    subtitle: "3 chats + 3 job posts every 7 days",
    price: 499,
  },
  {
    id: "emp_gold",
    title: "Gold · weekly",
    subtitle: "7 chats + 5 job posts every 7 days + priority support",
    price: 899,
    best: true,
  },
];

export default function JobPostModal({ visible, onClose, jobTitle }) {
  const navigation = useNavigation();
  const [selected, setSelected] = useState("job_post");

  const shortTitle = (jobTitle || "").trim();

  function handleContinue() {
    const plan = PLAN_OPTIONS.find((p) => p.id === selected) || PLAN_OPTIONS[0];

    onClose();

    navigation.navigate("MpesaCheckout", {
      plan: plan.id,
      label:
        plan.id === "job_post"
          ? shortTitle
            ? `Post "${shortTitle}"`
            : "Post a job"
          : plan.title,
    });
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <Pressable style={styles.flex} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.grabber} />

        <Text style={styles.title}>Post this job</Text>
        <Text style={styles.subtitle}>
          One post credit publishes it for 30 days — or pick a plan that also
          covers chatting with maids.
        </Text>

        {PLAN_OPTIONS.map((plan) => {
          const on = selected === plan.id;

          return (
            <Pressable
              key={plan.id}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              style={({ pressed }) => [
                styles.option,
                on && styles.optionOn,
                pressed && styles.optionPressed,
              ]}
              onPress={() => setSelected(plan.id)}
            >
              <View style={[styles.radio, on && styles.radioOn]}>
                {on ? <View style={styles.radioDot} /> : null}
              </View>

              <View style={styles.optionBody}>
                <View style={styles.optionTitleRow}>
                  <Text style={styles.optionTitle}>{plan.title}</Text>
                  {plan.best ? (
                    <View style={styles.bestPill}>
                      <Text style={styles.bestText}>Best value</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.optionSubtitle} numberOfLines={2}>
                  {plan.subtitle}
                </Text>
              </View>

              <Text style={styles.optionPrice}>KES {plan.price}</Text>
            </Pressable>
          );
        })}

        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.continueButton,
            pressed && styles.continuePressed,
          ]}
          onPress={handleContinue}
        >
          <TabBarIcon name="credit-card" color={colors.white} size={16} />
          <Text style={styles.continueText}>Continue with M-Pesa</Text>
        </Pressable>

        <Text style={styles.footnote}>
          Paid via M-Pesa STK push. A standard post publishes this listing for
          30 days; plans and the Hire Pass also cover chats with maids.
        </Text>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: "rgba(38, 49, 43, 0.45)",
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 28,
  },
  grabber: {
    alignSelf: "center",
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.cloud,
    marginBottom: 16,
  },
  title: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "800",
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 12.5,
    lineHeight: 18,
    marginTop: 4,
    marginBottom: 16,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.mistDark,
    borderRadius: 14,
    padding: 13,
    marginBottom: 10,
    gap: 12,
  },
  optionOn: {
    borderColor: colors.brand,
    backgroundColor: withAlpha(colors.brand, 0.06),
  },
  optionPressed: {
    opacity: 0.85,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.mistDark,
    alignItems: "center",
    justifyContent: "center",
  },
  radioOn: {
    borderColor: colors.brand,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.brand,
  },
  optionBody: {
    flex: 1,
  },
  optionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  optionTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "800",
  },
  bestPill: {
    backgroundColor: withAlpha(colors.gold, 0.2),
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  bestText: {
    color: colors.goldDark,
    fontSize: 10,
    fontWeight: "800",
  },
  optionSubtitle: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  optionPrice: {
    color: colors.brand,
    fontSize: 14,
    fontWeight: "800",
  },
  continueButton: {
    minHeight: 52,
    borderRadius: 15,
    backgroundColor: colors.brand,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 6,
  },
  continuePressed: {
    opacity: 0.92,
  },
  continueText: {
    color: colors.white,
    fontSize: 14.5,
    fontWeight: "800",
  },
  footnote: {
    color: colors.textMuted,
    fontSize: 11.5,
    lineHeight: 17,
    textAlign: "center",
    marginTop: 12,
    paddingHorizontal: 8,
  },
});
