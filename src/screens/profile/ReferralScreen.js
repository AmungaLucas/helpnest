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

import ScreenHeader from "../../components/ui/ScreenHeader";
import GradientBanner from "../../components/ui/GradientBanner";
import EmptyState from "../../components/ui/EmptyState";
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

      {/* v3 drawer-screen bar: hamburger + eyebrow + title (replaces the
          bespoke hamburger row + in-body title block). */}
      <ScreenHeader
        leading="hamburger"
        eyebrow="Invite friends"
        title="Earn with referrals"
        tone="canvas"
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <Text style={styles.note}>Loading your invite code…</Text>
        ) : referral?.code ? (
          <>
            {/* The screen's one GradientBanner — invite-code hero. */}
            <GradientBanner style={styles.hero}>
              <Text style={styles.heroEyebrow}>Your invite code</Text>
              <Text style={styles.heroCode}>{referral.code}</Text>
              <Pressable
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.shareButton,
                  pressed && styles.pressed,
                ]}
                onPress={shareInvite}
                android_ripple={{ color: withAlpha(colors.brand, 0.08) }}
              >
                <Text style={styles.shareButtonText}>Share code</Text>
              </Pressable>
            </GradientBanner>

            <Text style={styles.note}>{referral.rewardText}</Text>

            {/* Cream stats strip with hairline dividers. */}
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
              <View style={styles.pendingPanel}>
                <TabBarIcon name="clock" color={colors.goldDark} size={16} />
                <Text style={styles.pendingNote}>
                  KES {pendingKes.toLocaleString("en-KE")} on the way — payouts
                  go out to M-Pesa once your balance reaches KES{" "}
                  {Number(referral.minPayoutKes || 0).toLocaleString("en-KE")}.
                </Text>
              </View>
            )}

            <View style={styles.howCard}>
              <Text style={styles.eyebrow}>How it works</Text>
              <HowStep
                n="1"
                title="Share your code"
                body="Send it to friends who need help around the house — or who are looking for work."
              />
              <HowStep
                n="2"
                title="They sign up"
                body="They enter your code when creating their HelpNest account."
              />
              <HowStep
                n="3"
                title="You earn"
                body="Your reward lands here once they complete their first paid action."
              />
            </View>

            <Text style={styles.footnote}>
              Rewards are credited when someone you invited completes their
              first paid action on HelpNest.
            </Text>
          </>
        ) : (
          <EmptyState
            icon="users"
            tone="gold"
            title="No invite code yet"
            body={"Your invite code isn't ready yet. Pull the screen again in a moment — if it stays empty, contact support and we'll sort it out."}
          />
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

function HowStep({ n, title, body }) {
  return (
    <View style={styles.stepRow}>
      <View style={styles.stepNumWrap}>
        <Text style={styles.stepNum}>{n}</Text>
      </View>
      <View style={styles.stepMain}>
        <Text style={styles.stepTitle}>{title}</Text>
        <Text style={styles.stepBody}>{body}</Text>
      </View>
    </View>
  );
}

// Soft card lift shared by the white surfaces on the cream canvas.
const CARD_SHADOW = {
  shadowColor: colors.ink,
  shadowOpacity: 0.05,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 4 },
  elevation: 1,
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
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
  note: {
    color: colors.textMuted,
    fontSize: 13.5,
    lineHeight: 20,
    marginBottom: 18,
  },
  hero: {
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
  },
  heroEyebrow: {
    color: withAlpha(colors.white, 0.72),
    fontSize: 10.5,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  heroCode: {
    color: colors.white,
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: 5,
    marginBottom: 14,
  },
  shareButton: {
    alignSelf: "flex-start",
    backgroundColor: colors.white,
    borderRadius: 14,
    minHeight: 48,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  shareButtonText: {
    color: colors.brand,
    fontSize: 14,
    fontWeight: "800",
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "stretch",
    backgroundColor: colors.cream,
    borderWidth: 1,
    borderColor: colors.linen,
    borderRadius: 16,
    paddingVertical: 16,
    marginBottom: 14,
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
  pendingPanel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: withAlpha(colors.gold, 0.12),
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
  },
  pendingNote: {
    flex: 1,
    color: colors.goldDark,
    fontSize: 12.5,
    lineHeight: 19,
    fontWeight: "600",
  },
  howCard: {
    backgroundColor: colors.white,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.mist,
    padding: 20,
    marginBottom: 16,
    ...CARD_SHADOW,
  },
  eyebrow: {
    color: colors.goldDark,
    fontSize: 10.5,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 14,
  },
  stepNumWrap: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: colors.cloud,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  stepNum: {
    color: colors.ink,
    fontSize: 12.5,
    fontWeight: "800",
  },
  stepMain: {
    flex: 1,
  },
  stepTitle: {
    color: colors.ink,
    fontSize: 14.5,
    fontWeight: "700",
  },
  stepBody: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 2,
  },
  footnote: {
    color: colors.textFaint,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "600",
  },
});
