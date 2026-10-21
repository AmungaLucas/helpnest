import React from "react";
import { StatusBar, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import HamburgerButton from "./HamburgerButton";
import EmptyState from "./EmptyState";
import { colors } from "../../theme/colors";

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
        <EmptyState icon={icon} title={title} body={blurb} />
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
  },
});
