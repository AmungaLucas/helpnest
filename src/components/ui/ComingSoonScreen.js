import React from "react";
import { StatusBar, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import HamburgerButton from "./HamburgerButton";
import TabBarIcon from "./TabBarIcon";
import { colors, withAlpha } from "../../theme/colors";

// Shared placeholder for features whose backend milestone hasn't landed
// yet (jobs, applications, KYC, reviews, chat requests…). Renders a calm
// branded empty state instead of a dead screen.
export default function ComingSoonScreen({
  icon = "star",
  title,
  blurb,
  withMenu = false,
}) {
  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.cream} />

      {withMenu ? (
        <View style={styles.menuRow}>
          <HamburgerButton />
        </View>
      ) : null}

      <View style={styles.center}>
        <View style={styles.badge}>
          <TabBarIcon name={icon} color={colors.brand} size={26} />
        </View>

        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{blurb}</Text>
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
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 36,
  },
  badge: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: withAlpha(colors.brand, 0.12),
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  title: {
    color: colors.ink,
    fontSize: 19,
    fontWeight: "800",
    marginBottom: 8,
    textAlign: "center",
  },
  body: {
    color: colors.textMuted,
    fontSize: 13.5,
    lineHeight: 21,
    textAlign: "center",
  },
});
