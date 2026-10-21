import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";

import { getMyReferrals } from "../../services/referralsService";
import HamburgerButton from "../../components/ui/HamburgerButton";
import TabBarIcon from "../../components/ui/TabBarIcon";
import EmptyState from "../../components/ui/EmptyState";
import GradientBanner from "../../components/ui/GradientBanner";
import { colors, withAlpha } from "../../theme/colors";

// Referral programme (drawer destination, both roles): invite code hero,
// earnings stats, how-it-works and the recent invites list. One round trip
// to /referrals/me; silent-failure friendly like the rest of the app.
export default function ReferralsScreen() {
  const [referral, setReferral] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    getMyReferrals()
      .then((d) => {
        setReferral(d);
        setError(false);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function refresh() {
    setRefreshing(true);
    try {
      const d = await getMyReferrals();
      setReferral(d);
      setError(false);
    } catch (e) {
      // keep last good data
    } finally {
      setRefreshing(false);
    }
  }

  async function shareInvite() {
    if (!referral?.code) return;
    try {
      await Share.share({
        message:
          referral.shareText ||
          `Join me on HelpNest — use my code ${referral.code} when you sign up!`,
      });
    } catch (e) {
      // User dismissed the share sheet — nothing to do.
    }
  }

  const stats = referral?.stats || {};

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.cream} />

      {/* Sticky drawer header — mirrors the other profile-area screens. */}
      <View style={styles.topBar}>
        <HamburgerButton />
        <View style={styles.topBarMain} pointerEvents="none">
          <Text style={styles.topBarEyebrow}>Invite friends</Text>
          <Text style={styles.topBarTitle}>Referrals</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={colors.brand}
          />
        }
      >
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={colors.brand} size="large" />
          </View>
        ) : error && !referral ? (
          <EmptyState
            icon="alert-triangle"
            tone="danger"
            title="Could not load referrals"
            body="Check your connection and pull down to refresh."
          />
        ) : (
          <>
            {/* Gradient hero — invite code + share CTA. */}
            <GradientBanner style={styles.hero}>
              <View style={styles.heroInner}>
                <Text style={styles.heroEyebrow}>Your invite code</Text>
                <Text style={styles.heroCode}>
                  {referral?.code || "———"}
                </Text>
                <Text style={styles.heroNote}>
                  {referral?.rewardText ||
                    "Invite friends and earn when they pay."}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.shareButton,
                    pressed && styles.pressed,
                  ]}
                  onPress={shareInvite}
                  disabled={!referral?.code}
                  android_ripple={{ color: withAlpha(colors.gold, 0.3) }}
                >
                  <TabBarIcon name="send" color={colors.brand} size={15} />
                  <Text style={styles.shareButtonText}>Share my code</Text>
                </Pressable>
              </View>
            </GradientBanner>

            {/* Earnings strip — invited / joined / earned. */}
            <View style={styles.statsRow}>
              <Stat value={stats.invited || 0} label="Invited" />
              <View style={styles.statDivider} />
              <Stat value={stats.qualified || 0} label="Paid" />
              <View style={styles.statDivider} />
              <Stat
                value={`KES ${Number(stats.earnedKes || 0).toLocaleString("en-KE")}`}
                label="Earned"
                strong
              />
            </View>

            {Number(stats.pendingKes || 0) > 0 ? (
              <View style={styles.pendingCard}>
                <View style={styles.pendingIcon}>
                  <TabBarIcon name="clock" color={colors.goldDark} size={18} />
                </View>
                <Text style={styles.pendingText}>
                  KES {Number(stats.pendingKes).toLocaleString("en-KE")} on the
                  way — payouts go out to M-Pesa once your balance reaches KES{" "}
                  {Number(referral?.minPayoutKes || 0).toLocaleString("en-KE")}.
                </Text>
              </View>
            ) : null}

            {/* How it works. */}
            <View style={styles.card}>
              <Text style={styles.cardEyebrow}>How it works</Text>
              <HowStep
                n="1"
                title="Share your code"
                body="Send your invite code to friends looking for work or help at home."
              />
              <HowStep
                n="2"
                title="They sign up and pay"
                body="They enter your code when creating their HelpNest account."
              />
              <HowStep
                n="3"
                title="You earn real cash"
                body="When their first payment goes through, your reward is credited here."
              />
            </View>

            {/* Recent invites. */}
            <View style={styles.card}>
              <Text style={styles.cardEyebrow}>Recent invites</Text>
              {referral?.referrals?.length ? (
                referral.referrals.map((r) => (
                  <View key={r.id} style={styles.refRow}>
                    <View style={styles.refAvatar}>
                      <Text style={styles.refAvatarText}>
                        {(r.name || "?").slice(0, 1).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.refMain}>
                      <Text style={styles.refName} numberOfLines={1}>
                        {r.name}
                      </Text>
                      <Text style={styles.refSub}>
                        {r.role === "maid" ? "Domestic worker" : "Employer"} ·{" "}
                        {r.status === "qualified"
                          ? "paid"
                          : r.status === "rejected"
                            ? "not eligible"
                            : "joined"}
                      </Text>
                    </View>
                    {r.earnedKes != null && r.earnedKes > 0 ? (
                      <View style={styles.refEarned}>
                        <Text style={styles.refEarnedText}>
                          +KES {Number(r.earnedKes).toLocaleString("en-KE")}
                        </Text>
                      </View>
                    ) : (
                      <View
                        style={[
                          styles.refChip,
                          r.status === "qualified"
                            ? styles.refChipOk
                            : styles.refChipIdle,
                        ]}
                      >
                        <Text
                          style={[
                            styles.refChipText,
                            r.status === "qualified" && styles.refChipTextOk,
                          ]}
                        >
                          {r.status === "qualified" ? "Paid" : "Pending"}
                        </Text>
                      </View>
                    )}
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>
                  No invites yet. Share your code to start earning.
                </Text>
              )}
            </View>

            <Text style={styles.versionText}>HelpNest v1.0.0</Text>
          </>
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
      <View style={styles.stepNum}>
        <Text style={styles.stepNumText}>{n}</Text>
      </View>
      <View style={styles.stepMain}>
        <Text style={styles.stepTitle}>{title}</Text>
        <Text style={styles.stepBody}>{body}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  pressed: {
    opacity: 0.88,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingTop: 6,
    paddingBottom: 8,
  },
  topBarMain: {
    flex: 1,
    marginHorizontal: 10,
  },
  topBarEyebrow: {
    color: colors.goldDark,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  topBarTitle: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  loadingWrap: {
    paddingVertical: 80,
    alignItems: "center",
  },
  hero: {
    borderRadius: 24,
    marginTop: 6,
    marginBottom: 16,
  },
  heroInner: {
    padding: 24,
  },
  heroEyebrow: {
    color: withAlpha(colors.white, 0.75),
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  heroCode: {
    color: colors.white,
    fontSize: 40,
    fontWeight: "800",
    letterSpacing: 6,
    marginTop: 8,
  },
  heroNote: {
    color: withAlpha(colors.white, 0.85),
    fontSize: 13,
    lineHeight: 19,
    marginTop: 10,
    marginBottom: 18,
  },
  shareButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.cream,
    borderRadius: 14,
    minHeight: 48,
    paddingHorizontal: 18,
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
    backgroundColor: colors.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.mist,
    paddingVertical: 16,
    marginBottom: 14,
    ...({
      shadowColor: colors.ink,
      shadowOpacity: 0.06,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 5 },
      elevation: 1,
    }),
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
  pendingCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: withAlpha(colors.gold, 0.14),
    borderWidth: 1,
    borderColor: withAlpha(colors.gold, 0.4),
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    gap: 12,
  },
  pendingIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: withAlpha(colors.gold, 0.2),
    alignItems: "center",
    justifyContent: "center",
  },
  pendingText: {
    flex: 1,
    color: colors.goldDark,
    fontSize: 12.5,
    lineHeight: 18,
    fontWeight: "600",
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.mist,
    padding: 18,
    marginBottom: 14,
    ...({
      shadowColor: colors.ink,
      shadowOpacity: 0.06,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 5 },
      elevation: 1,
    }),
  },
  cardEyebrow: {
    color: colors.goldDark,
    fontSize: 10.5,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 14,
  },
  stepRow: {
    flexDirection: "row",
    marginBottom: 14,
  },
  stepNum: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: withAlpha(colors.brand, 0.1),
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  stepNumText: {
    color: colors.brand,
    fontSize: 14,
    fontWeight: "800",
  },
  stepMain: {
    flex: 1,
  },
  stepTitle: {
    color: colors.ink,
    fontSize: 14.5,
    fontWeight: "800",
  },
  stepBody: {
    color: colors.textMuted,
    fontSize: 12.5,
    lineHeight: 18,
    marginTop: 2,
  },
  refRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 52,
    paddingVertical: 7,
  },
  refAvatar: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: withAlpha(colors.brand, 0.12),
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  refAvatarText: {
    color: colors.brand,
    fontSize: 15,
    fontWeight: "800",
  },
  refMain: {
    flex: 1,
    marginRight: 10,
  },
  refName: {
    color: colors.ink,
    fontSize: 13.5,
    fontWeight: "700",
  },
  refSub: {
    color: colors.textMuted,
    fontSize: 11.5,
    marginTop: 2,
  },
  refEarned: {
    backgroundColor: withAlpha(colors.brand, 0.1),
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  refEarnedText: {
    color: colors.brand,
    fontSize: 11.5,
    fontWeight: "800",
  },
  refChip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  refChipOk: {
    backgroundColor: withAlpha(colors.brand, 0.1),
  },
  refChipIdle: {
    backgroundColor: withAlpha(colors.gold, 0.16),
  },
  refChipText: {
    color: colors.goldDark,
    fontSize: 11,
    fontWeight: "800",
  },
  refChipTextOk: {
    color: colors.brand,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  versionText: {
    color: colors.textFaint,
    fontSize: 11.5,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 6,
  },
});
