import React from "react";
import { Pressable, StatusBar, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "../context/AuthContext";
import { logout } from "../services/authService";
import { HelpNestLogoMark } from "../components/Logo";
import { colors, withAlpha } from "../theme/colors";

const ROLE_LABELS = {
  maid: "Domestic Worker",
  employer: "Employer",
  admin: "Admin",
};

// Placeholder dashboard — the role-specific home (PRD §5) is the next build.
export default function HomeScreen() {
  const { user, clearSession } = useAuth();

  const firstName = (user?.name || "").split(" ")[0];

  async function handleSignOut() {
    try {
      await logout();
    } catch (error) {
      // Clear locally even if the server call fails.
    }
    clearSession();
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={colors.brand} />

      <View style={styles.header}>
        <View style={styles.brandRow}>
          <View style={styles.logoBadge}>
            <HelpNestLogoMark size={22} />
          </View>
          <Text style={styles.brandText}>HelpNest</Text>
        </View>
        <Pressable accessibilityRole="button" onPress={handleSignOut}>
          <Text style={styles.signOut}>Sign out</Text>
        </Pressable>
      </View>

      <View style={styles.body}>
        <Text style={styles.karibu}>Karibu{firstName ? `, ${firstName}` : ""} 👋</Text>
        <Text style={styles.roleLine}>
          You're in as a verified-in-progress{" "}
          <Text style={styles.roleBold}>
            {ROLE_LABELS[user?.role] || user?.role || "member"}
          </Text>
          .
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Coming up next</Text>
          <Text style={styles.cardText}>
            {user?.role === "maid"
              ? "Your profile, job feed and applications are being built."
              : "Browse maids, post jobs and manage applications are being built."}
          </Text>
        </View>

        <View style={styles.statusCard}>
          <View style={styles.statusRow}>
            <View style={[styles.dot, user?.phoneVerified ? styles.dotOk : styles.dotIdle]} />
            <Text style={styles.statusText}>
              Phone {user?.phoneVerified ? "verified" : "not verified"}
            </Text>
          </View>
          <View style={styles.statusRow}>
            <View style={[styles.dot, user?.emailVerified ? styles.dotOk : styles.dotIdle]} />
            <Text style={styles.statusText}>
              Email {user?.emailVerified ? "verified" : "verification coming soon"}
            </Text>
          </View>
          <View style={styles.statusRow}>
            <View style={[styles.dot, styles.dotIdle]} />
            <Text style={styles.statusText}>
              KYC: {user?.kycStatus || "unverified"}
            </Text>
          </View>
        </View>
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
    backgroundColor: colors.brand,
    paddingHorizontal: 22,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  logoBadge: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: colors.cream,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  brandText: {
    color: colors.white,
    fontSize: 17,
    fontWeight: "800",
  },
  signOut: {
    color: withAlpha(colors.cream, 0.75),
    fontSize: 13,
    fontWeight: "700",
  },
  body: {
    flex: 1,
    padding: 22,
  },
  karibu: {
    color: colors.ink,
    fontSize: 26,
    fontWeight: "800",
    marginBottom: 6,
  },
  roleLine: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 24,
  },
  roleBold: {
    color: colors.brand,
    fontWeight: "800",
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.mist,
    padding: 18,
    marginBottom: 14,
  },
  cardTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 6,
  },
  cardText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 20,
  },
  statusCard: {
    backgroundColor: colors.mist,
    borderRadius: 18,
    padding: 18,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 5,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 9,
  },
  dotOk: {
    backgroundColor: colors.brandSoft,
  },
  dotIdle: {
    backgroundColor: colors.gold,
  },
  statusText: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "600",
  },
});
