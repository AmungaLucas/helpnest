import React, { useCallback, useState } from "react";
import {
  Pressable,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";

import HamburgerButton from "../../components/ui/HamburgerButton";
import TabBarIcon from "../../components/ui/TabBarIcon";
import { getMyReferrals } from "../../services/referralsService";
import { colors, withAlpha } from "../../theme/colors";

// Refer & earn — its own drawer screen (moved out of the profile overview).
// Shows the member's invite code, the reward rules from the server, and a
// running tally of invited / paid / earned. Reloads on every focus so the
// numbers are current right after someone signs up with the code.
export default function ReferralScreen() {
  const [referral, setReferral] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadReferral = useCallback(() => {
    getMyReferrals()
      .then(setReferral)
      .catch(() => setReferral(null))
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadReferral();
    }, [loadReferral])
  );

  async function shareInvite() {
    if (!referral?.code) return;
    try {
      await Share.share({
        message:
          referral.shareText ||
          `Join me on HelpNest — use my code ${referral.code} when you sign up!`,
      });
    } catch (error) {
      // User dismissed the share sheet — nothing to do.
    }
  }

  const pendingKes = Number(referral?.stats?.pendingKes || 0);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.cream} />

      <View style={styles.menuRow}>
        <HamburgerButton />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.titleRow}>
          <View style={styles.titleIcon}>
            <TabBarIcon name="users" color={colors.brand} size={20} />
          </View>
          <View style={styles.titleMain}>
            <Text style={styles.eyebrow}>Invite friends</Text>
            <Text style={styles.title}>Earn with referrals</Text>
          </View>
        </View>

        {loading ? (
          <Text style={styles.note}>Loading your invite code…</Text>
        ) : referral?.code ? (
          <>
            <Text style={styles.note}>{referral.rewardText}</Text>

            <View style={styles.codeRow}>
              <Text style={styles.code}>{referral.code}</Text>
              <Pressable
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.shareButton,
                  pressed && styles.pressed,
                ]}
                onPress={shareInvite}
              >
                <Text style={styles.shareButtonText}>Share code</Text>
              </Pressable>
            </View>

            <View style={styles.statsRow}>
              <Stat value={referral.stats?.invited || 0} label="invited" />
              <View style={styles.statDivider} />
              <Stat value={referral.stats?.qualified || 0} label="paid" />
              <View style={styles.statDivider} />
              <Stat
                value={`KES ${Number(referral.stats?.earnedKes || 0).toLocaleString("en-KE")}`}
                label="earned"
                strong
              />
            </View>

            {pendingKes > 0 && (
              <Text style={styles.pendingNote}>
                KES {pendingKes.toLocaleString("en-KE")} on the way — payouts
                go out to M-Pesa once your balance reaches KES{" "}
                {Number(referral.minPayoutKes || 0).toLocaleString("en-KE")}.
              </Text>
            )}

            <Text style={styles.footnote}>
              Rewards are credited when someone you invited completes their
              first paid action on HelpNest.
            </Text>
          </>
        ) : (
          <Text style={styles.note}>
            Your invite code isn't ready yet. Pull the screen again in a
            moment — if it stays empty, contact support and we'll sort it
            out.
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ value, label, strong }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, strong && styles.statValueStrong]}>
        {value}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  menuRow: {
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 10,
    backgroundColor: colors.cream,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 28,
  },
  pressed: {
    opacity: 0.88,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  titleIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: withAlpha(colors.brand, 0.1),
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  titleMain: {
    flex: 1,
  },
  eyebrow: {
    color: colors.goldDark,
    fontSize: 10.5,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 3,
  },
  title: {
    color: colors.ink,
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  note: {
    color: colors.textMuted,
    fontSize: 13.5,
    lineHeight: 20,
    marginBottom: 18,
  },
  codeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: withAlpha(colors.brand, 0.25),
    padding: 14,
    marginBottom: 16,
    shadowColor: colors.ink,
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 1,
  },
  code: {
    color: colors.brand,
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: 2.5,
  },
  shareButton: {
    backgroundColor: colors.brand,
    borderRadius: 12,
    minHeight: 44,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  shareButtonText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: "800",
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "stretch",
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.mist,
    paddingVertical: 14,
    marginBottom: 12,
    shadowColor: colors.ink,
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 1,
  },
  stat: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  statDivider: {
    width: 1,
    backgroundColor: colors.mistDark,
  },
  statValue: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  statValueStrong: {
    color: colors.brand,
  },
  statLabel: {
    color: colors.textFaint,
    fontSize: 10.5,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginTop: 3,
  },
  pendingNote: {
    color: colors.goldDark,
    fontSize: 12.5,
    lineHeight: 19,
    fontWeight: "600",
    marginBottom: 14,
  },
  footnote: {
    color: colors.textFaint,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "600",
  },
});
