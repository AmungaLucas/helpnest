import React, { useCallback, useState } from "react";
import {
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation } from "@react-navigation/native";

import { useAuth } from "../../context/AuthContext";
import { getMyWorkerProfile } from "../../services/workersService";
import { getEntitlements } from "../../services/entitlementsService";
import { HelpNestLogoMark } from "../../components/Logo";
import LocationPromptCard from "../../components/ui/LocationPromptCard";
import TabBarIcon from "../../components/ui/TabBarIcon";
import GradientBanner from "../../components/ui/GradientBanner";
import { colors, withAlpha } from "../../theme/colors";

// Maid home (PRD §5.2): get the worker search-ready and into work fast.
export default function MaidHomeScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();

  const [profile, setProfile] = useState(null);
  const [ent, setEnt] = useState(null);

  const firstName = (user?.name || "").split(" ")[0] || "";

  // Re-check the work profile on focus so the completeness card updates
  // right after the user edits Skills & experience in the drawer.
  useFocusEffect(
    useCallback(() => {
      let active = true;

      getMyWorkerProfile()
        .then((data) => {
          if (active) setProfile(data.worker || null);
        })
        .catch(() => {
          // Non-fatal — the completeness card falls back to account fields.
          if (active) setProfile(null);
        });

      getEntitlements()
        .then((data) => {
          if (active) setEnt(data || null);
        })
        .catch(() => {
          // Non-fatal — the plans card just renders its default copy.
          if (active) setEnt(null);
        });

      return () => {
        active = false;
      };
    }, [])
  );

  const checklist = [
    {
      label: "Phone verified",
      done: Boolean(user?.phoneVerified),
    },
    {
      label: "Area added",
      done: user?.locationLat !== null && user?.locationLat !== undefined,
    },
    {
      label: "Title & about you",
      done: Boolean(profile?.title && profile.title.trim().length >= 3),
    },
    {
      label: "At least one service",
      done: (profile?.services || []).length > 0,
    },
    {
      label: "Rate & availability",
      done:
        (profile?.hourlyRate ?? 0) > 0 || Boolean(profile?.availability),
    },
  ];
  const doneCount = checklist.filter((item) => item.done).length;
  const progress = Math.round((doneCount / checklist.length) * 100);
  const searchReady = Boolean(profile?.searchReady);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar barStyle="light-content" backgroundColor={colors.brand} />

      {/* ---------- Brand header ---------- */}
      <GradientBanner style={styles.header}>
        <View style={styles.brandRow}>
          <View style={styles.logoBadge}>
            <HelpNestLogoMark size={22} />
          </View>
          <Text style={styles.brandText}>HelpNest</Text>
        </View>
        <View style={styles.headerPill}>
          <Text style={styles.headerPillText}>Domestic Worker</Text>
        </View>
      </GradientBanner>

      <ScrollView
        style={styles.bodyScroll}
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.karibu}>Karibu{firstName ? `, ${firstName}` : ""} 👋</Text>
        <Text style={styles.lede}>
          Let's get your profile in front of employers and land your next job.
        </Text>

        {/* ---------- Profile completeness ---------- */}
        <Pressable
          accessibilityRole="button"
          android_ripple={{ color: withAlpha(colors.brand, 0.08) }}
          style={({ pressed }) => [
            styles.progressCard,
            pressed && styles.cardPressed,
          ]}
          onPress={() => navigation.navigate("ProfileTab", { screen: "Skills" })}
        >
          <Text style={styles.eyebrow}>Search readiness</Text>
          <View style={styles.progressTopRow}>
            <Text style={styles.progressTitle}>Complete your profile</Text>
            <Text style={styles.progressValue}>{progress}%</Text>
          </View>

          <View style={styles.track}>
            <View style={[styles.fill, { width: `${Math.max(progress, 4)}%` }]} />
          </View>

          <View style={styles.checklist}>
            {checklist.map((item) => (
              <View
                key={item.label}
                style={[
                  styles.checkChip,
                  item.done ? styles.checkChipDone : styles.checkChipTodo,
                ]}
              >
                <TabBarIcon
                  name="check"
                  color={item.done ? colors.brand : colors.textFaint}
                  size={12}
                />
                <Text
                  style={[
                    styles.checkChipText,
                    item.done
                      ? styles.checkChipTextDone
                      : styles.checkChipTextTodo,
                  ]}
                >
                  {item.label}
                </Text>
              </View>
            ))}
          </View>

          <Text style={styles.progressCta}>
            {progress === 100
              ? "All set — keep your profile fresh. Tap to review."
              : "Tap to finish the missing bits"}
          </Text>
        </Pressable>

        {/* ---------- Search-ready status ---------- */}
        <View
          style={[
            styles.readyCard,
            searchReady ? styles.readyOk : styles.readyHidden,
          ]}
        >
          <TabBarIcon
            name={searchReady ? "check" : "shield"}
            color={searchReady ? colors.brand : colors.goldDark}
            size={15}
          />
          <Text
            style={[
              styles.readyText,
              searchReady ? styles.readyTextOk : styles.readyTextHidden,
            ]}
          >
            {searchReady
              ? "You're visible in Find Help — employers can reach you now."
              : "You're hidden from search. Go live from Skills & experience once your profile is ready."}
          </Text>
        </View>

        {/* ---------- Quick actions ---------- */}
        <View style={styles.actionsRow}>
          <Pressable
            accessibilityRole="button"
            android_ripple={{ color: withAlpha(colors.white, 0.16) }}
            style={({ pressed }) => [
              styles.actionCard,
              styles.actionPrimary,
              pressed && styles.cardPressed,
            ]}
            onPress={() => navigation.navigate("FindJobsTab")}
          >
            <View style={[styles.actionIcon, styles.actionIconOnBrand]}>
              <TabBarIcon name="search" color={colors.white} size={18} />
            </View>
            <Text style={[styles.actionTitle, styles.actionTitleLight]}>
              Find jobs
            </Text>
            <Text style={[styles.actionText, styles.actionTextLight]}>
              Browse openings near you
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            android_ripple={{ color: withAlpha(colors.brand, 0.08) }}
            style={({ pressed }) => [
              styles.actionCard,
              pressed && styles.cardPressed,
            ]}
            onPress={() => navigation.navigate("ApplicationsTab")}
          >
            <View style={styles.actionIcon}>
              <TabBarIcon name="file-text" color={colors.brand} size={18} />
            </View>
            <Text style={styles.actionTitle}>My applications</Text>
            <Text style={styles.actionText}>
              Track what you've applied to
            </Text>
          </Pressable>
        </View>

        {/* ---------- Featured / boost promo (moved from Account) ----------
            Dark premium "ad" surface — the only ink-dark card on the screen,
            so paid placement reads as something special. */}
        <View style={styles.promoCard}>
          <View pointerEvents="none" style={styles.promoGhost}>
            <TabBarIcon name="zap" color={withAlpha(colors.gold, 0.14)} size={96} />
          </View>
          <View style={styles.promoHead}>
            <View style={styles.promoBadge}>
              <TabBarIcon name="zap" color={colors.gold} size={20} />
            </View>
            <View style={styles.promoHeadText}>
              <Text style={styles.promoEyebrow}>Featured</Text>
              <Text style={styles.promoTitle}>Boost your profile</Text>
            </View>
          </View>
          <Text style={styles.promoCopy}>
            Get a labeled “Featured” placement at the top of employer searches
            for 7 days.
          </Text>
          <View style={styles.promoFoot}>
            <View style={styles.promoPrice}>
              <Text style={styles.promoPriceText}>KES 100 · 7 days</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              android_ripple={{ color: withAlpha(colors.ink, 0.18) }}
              style={({ pressed }) => [
                styles.promoCta,
                pressed && styles.tilePressed,
              ]}
              onPress={() =>
                navigation.navigate("MpesaCheckout", {
                  plan: "profile_boost",
                  label: "Profile boost — 7 days featured",
                })
              }
            >
              <Text style={styles.promoCtaText}>Boost now</Text>
            </Pressable>
          </View>
        </View>

        <LocationPromptCard />

        {/* ---------- Application plans (PRD §5.1 maid products) ---------- */}
        <View style={styles.planCard}>
          <View style={styles.planHead}>
            <View style={styles.planHeadLeft}>
              <Text style={styles.cardEyebrow}>Weekly plans</Text>
              <Text style={styles.planTitle}>Get more applications</Text>
            </View>
            {ent?.subscription ? (
              <View style={styles.planActivePill}>
                <Text style={styles.planActiveText}>Active</Text>
              </View>
            ) : null}
          </View>

          {ent?.subscription ? (
            <Text style={styles.planActiveCopy}>
              {ent.subscription.planLabel} · active until{" "}
              {new Date(ent.subscription.expiresAt).toLocaleDateString("en-KE", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
              .
            </Text>
          ) : (
            <>
              <Text style={styles.planCopy}>
                {ent?.credits?.apply > 0
                  ? `${ent.credits.apply} application${ent.credits.apply === 1 ? "" : "s"} ready — or grab a weekly bundle:`
                  : "Your first application is free. After that, bundles keep the search going:"}
              </Text>
              <View style={styles.planRow}>
                <Pressable
                  accessibilityRole="button"
                  android_ripple={{ color: withAlpha(colors.brand, 0.08) }}
                  style={({ pressed }) => [
                    styles.planTile,
                    pressed && styles.tilePressed,
                  ]}
                  onPress={() =>
                    navigation.navigate("MpesaCheckout", {
                      plan: "maid_basic",
                      label: "Basic — 3 applications",
                    })
                  }
                >
                  <Text style={styles.planName}>Basic</Text>
                  <Text style={styles.planPrice}>KES 199</Text>
                  <Text style={styles.planPer}>3 applications · 7 days</Text>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  android_ripple={{ color: withAlpha(colors.brand, 0.08) }}
                  style={({ pressed }) => [
                    styles.planTile,
                    styles.planTileBest,
                    pressed && styles.tilePressed,
                  ]}
                  onPress={() =>
                    navigation.navigate("MpesaCheckout", {
                      plan: "maid_gold",
                      label: "Gold — 10 applications",
                    })
                  }
                >
                  <View style={styles.planBest}>
                    <Text style={styles.planBestText}>Best value</Text>
                  </View>
                  <Text style={styles.planName}>Gold</Text>
                  <Text style={styles.planPrice}>KES 349</Text>
                  <Text style={styles.planPer}>10 applications · 7 days</Text>
                </Pressable>
              </View>
              <Text style={styles.planFootnote}>
                Just one role? A single application is KES 50 on any job.
              </Text>
            </>
          )}
        </View>

        {/* ---------- Tips ---------- */}
        <View style={styles.tipsCard}>
          <Text style={styles.tipsEyebrow}>Good to know</Text>
          <Text style={styles.tipsTitle}>Tips to get hired faster</Text>
          <Text style={styles.tipLine}>
            • Use a clear title like "Experienced childcare helper" — vague
            titles get skipped.
          </Text>
          <Text style={styles.tipLine}>
            • Mention the areas you can work in; employers search by location.
          </Text>
          <Text style={styles.tipLine}>
            • A fair hourly rate beats "negotiable" — it builds trust early.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  /* ---- Card eyebrow (shared) ---- */
  cardEyebrow: {
    color: colors.goldDark,
    fontSize: 10.5,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 3,
  },

  /* ---- Application plans ---- */
  planCard: {
    backgroundColor: colors.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.mist,
    padding: 16,
    marginBottom: 14,
    shadowColor: colors.ink,
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  planHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  planHeadLeft: {
    flex: 1,
  },
  planTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "800",
  },
  planActivePill: {
    backgroundColor: withAlpha(colors.brand, 0.12),
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  planActiveText: {
    color: colors.brand,
    fontSize: 11,
    fontWeight: "800",
  },
  planActiveCopy: {
    color: colors.textMuted,
    fontSize: 12.5,
    lineHeight: 19,
    fontWeight: "600",
    marginTop: 8,
  },
  planCopy: {
    color: colors.textMuted,
    fontSize: 12.5,
    lineHeight: 19,
    fontWeight: "600",
    marginTop: 6,
    marginBottom: 12,
  },
  planRow: {
    flexDirection: "row",
    gap: 10,
  },
  planTile: {
    flex: 1,
    backgroundColor: colors.cream,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.mist,
    padding: 14,
  },
  planTileBest: {
    borderColor: colors.gold,
    backgroundColor: withAlpha(colors.gold, 0.08),
  },
  planBest: {
    alignSelf: "flex-start",
    backgroundColor: withAlpha(colors.gold, 0.16),
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginBottom: 6,
  },
  planBestText: {
    color: colors.goldDark,
    fontSize: 10,
    fontWeight: "800",
  },
  planName: {
    color: colors.ink,
    fontSize: 13.5,
    fontWeight: "800",
  },
  planPrice: {
    color: colors.brand,
    fontSize: 16,
    fontWeight: "800",
    marginTop: 2,
  },
  planPer: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "600",
    lineHeight: 15,
    marginTop: 4,
  },
  planFootnote: {
    color: colors.textMuted,
    fontSize: 11.5,
    lineHeight: 17,
    fontWeight: "600",
    marginTop: 12,
  },
  tilePressed: {
    opacity: 0.88,
  },
  safeArea: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 14,
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
  headerPill: {
    backgroundColor: withAlpha(colors.white, 0.16),
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  headerPillText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  bodyScroll: {
    flex: 1,
  },
  body: {
    padding: 20,
    paddingBottom: 36,
  },
  karibu: {
    color: colors.ink,
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.6,
    marginBottom: 6,
  },
  lede: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 20,
  },

  /* ---- Completeness card ---- */
  progressCard: {
    backgroundColor: colors.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.mist,
    padding: 16,
    marginBottom: 14,
    shadowColor: colors.ink,
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  eyebrow: {
    color: colors.goldDark,
    fontSize: 10.5,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  progressTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  progressTitle: {
    color: colors.ink,
    fontSize: 15.5,
    fontWeight: "800",
  },
  progressValue: {
    color: colors.brand,
    fontSize: 18,
    fontWeight: "800",
  },
  track: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.mist,
    overflow: "hidden",
    marginBottom: 12,
  },
  fill: {
    height: "100%",
    borderRadius: 4,
    backgroundColor: colors.brand,
  },
  /* ---- Completeness chips (2-col grid) ---- */
  checklist: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 10,
  },
  checkChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    width: "48.5%",
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 7,
  },
  checkChipDone: {
    backgroundColor: withAlpha(colors.brand, 0.1),
  },
  checkChipTodo: {
    backgroundColor: colors.mist,
  },
  checkChipText: {
    flexShrink: 1,
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 15,
  },
  checkChipTextDone: {
    color: colors.ink,
  },
  checkChipTextTodo: {
    color: colors.textMuted,
  },
  progressCta: {
    color: colors.brand,
    fontSize: 12.5,
    fontWeight: "800",
    marginTop: 2,
  },

  /* ---- Search-ready status ---- */
  readyCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 999,
    paddingVertical: 9,
    paddingHorizontal: 14,
    gap: 8,
    marginBottom: 14,
  },
  readyOk: {
    backgroundColor: withAlpha(colors.brand, 0.1),
  },
  readyHidden: {
    backgroundColor: withAlpha(colors.gold, 0.13),
  },
  readyText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
  },
  readyTextOk: {
    color: colors.brand,
  },
  readyTextHidden: {
    color: colors.goldDark,
  },

  /* ---- Quick actions ---- */
  actionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  actionCard: {
    width: "48.5%",
    backgroundColor: colors.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.mist,
    padding: 15,
    minHeight: 122,
    shadowColor: colors.ink,
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  actionPrimary: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: withAlpha(colors.brand, 0.08),
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  actionIconOnBrand: {
    backgroundColor: withAlpha(colors.white, 0.16),
  },
  cardPressed: {
    opacity: 0.88,
  },
  actionTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "800",
    marginTop: 0,
  },
  actionTitleLight: {
    color: colors.white,
  },
  actionText: {
    color: colors.textMuted,
    fontSize: 11.5,
    lineHeight: 16,
    fontWeight: "600",
    marginTop: 3,
  },
  actionTextLight: {
    color: withAlpha(colors.cream, 0.82),
  },

  /* ---- Featured / boost promo — dark premium ad surface ---- */
  promoCard: {
    backgroundColor: colors.ink,
    borderRadius: 22,
    padding: 18,
    marginBottom: 14,
    overflow: "hidden",
    shadowColor: colors.ink,
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  promoGhost: {
    position: "absolute",
    top: -20,
    right: -16,
  },
  promoHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
  },
  promoBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: withAlpha(colors.gold, 0.18),
    borderWidth: 1,
    borderColor: withAlpha(colors.gold, 0.32),
    alignItems: "center",
    justifyContent: "center",
  },
  promoHeadText: {
    flex: 1,
  },
  promoEyebrow: {
    color: colors.gold,
    fontSize: 10.5,
    fontWeight: "800",
    letterSpacing: 1.4,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  promoTitle: {
    color: colors.white,
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  promoCopy: {
    color: withAlpha(colors.cream, 0.66),
    fontSize: 12.5,
    lineHeight: 18,
    fontWeight: "600",
    marginBottom: 14,
  },
  promoFoot: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  promoPrice: {
    backgroundColor: withAlpha(colors.gold, 0.16),
    borderWidth: 1,
    borderColor: withAlpha(colors.gold, 0.3),
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  promoPriceText: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: "800",
  },
  promoCta: {
    backgroundColor: colors.gold,
    borderRadius: 999,
    minHeight: 40,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  promoCtaText: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "800",
  },

  /* ---- Tips ---- */
  tipsCard: {
    backgroundColor: colors.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.mist,
    padding: 16,
    marginTop: 0,
    shadowColor: colors.ink,
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  tipsEyebrow: {
    color: colors.goldDark,
    fontSize: 10.5,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 3,
  },
  tipsTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 8,
  },
  tipLine: {
    color: colors.textMuted,
    fontSize: 12.5,
    lineHeight: 19,
    fontWeight: "600",
    marginBottom: 6,
  },
});
