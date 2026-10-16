import React from "react";
import { StyleSheet, Text, View } from "react-native";

import TabBarIcon from "../../components/ui/TabBarIcon";
import { colors, withAlpha } from "../../theme/colors";

// Placeholder for contact-reveal and interview request management
// (PRD §8/§10). Lives inside the Chats Material Top Tabs.
export default function RequestsScreen() {
  return (
    <View style={styles.safeArea}>
      <View style={styles.center}>
        <View style={styles.badge}>
          <TabBarIcon name="shield" color={colors.brand} size={26} />
        </View>

        <Text style={styles.title}>Requests are coming soon</Text>
        <Text style={styles.body}>
          When an employer unlocks your contact or invites you to interview,
          the request shows up here — accept or decline without exposing your
          number before you're ready.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.white,
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
