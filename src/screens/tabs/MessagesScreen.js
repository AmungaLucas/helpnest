import React from "react";
import { StatusBar, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { HelpNestLogoMark } from "../../components/Logo";
import { colors, withAlpha } from "../../theme/colors";

// Placeholder for PRD §8 (safe in-app messaging with anti-contact-sharing).
export default function MessagesScreen() {
  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.cream} />

      <View style={styles.center}>
        <View style={styles.badge}>
          <HelpNestLogoMark size={30} />
        </View>

        <Text style={styles.title}>Messages are coming soon</Text>
        <Text style={styles.body}>
          You'll chat with employers and workers right here — with phone
          numbers and payments kept inside HelpNest until a hire is agreed,
          so nobody can be scammed mid-conversation.
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
