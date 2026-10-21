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

const MAID_PLAN_TILES = [
  {
    id: "maid_basic",
    name: "Basic",
    price: 199,
    per: "3 applications · 7 days",
    label: "Basic — 3 applications",
  },
  {
    id: "maid_gold",
    name: "Gold",
    price: 349,
    per: "10 applications · 7 days",
    label: "Gold — 10 applications",
    best: true,
  },
];

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
      <StatusBar barStyle="dark-content" backgroundColor={colors.cream} />

      <ScrollView
        style={styles.bodyScroll}
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
      >
        {/* ---------- Hero ---------- */}
        <View style={styles.hero}>
          <View style={styles.orb1} />
          <View style={styles.orb2} />
          <View style={styles.orb3} />

          <Text style={styles.kicker}>MAID · HOME</Text>
          <Text style={styles.karibu}>
            Karibu{firstName ? `, ${firstName}` : ""} 👋
          </Text>
          <Text style={styles.lede}>
            Let's get your profile in front of employers and land your next
            job.
          </Text>

          <View
            style={[
              styles.readyPill,
              searchReady ? styles.readyPillOk : styles.readyPillHidden,
            ]}
          >
            <View
              style={[
                styles.readyDot,
                searchReady ? styles.readyDotOk : styles.readyDotHidden,
              ]}
            />
            <Text
              style={[
                styles.readyPillText,
                searchReady
                  ? styles.readyPillTextOk
                  : styles.readyPillTextHidden,
              ]}
            >
              {searchReady
                ? "You're visible in Find Help — employers can reach you now."
                : "You're hidden from search. Go live from Skills & experience once your profile is ready."}
            </Text>
          </View>
        </View>

        <View style={styles.content}>
          {/* ---------- Profile completeness (compact) ---------- */}
          <Pressable
            accessibilityRole="button"
            android_ripple={{ color: withAlpha(colors.brand, 0.06) }}
            style={({ pressed }) => [
              styles.readinessCard,
              pressed && styles.cardPressed,
            ]}
            onPress={() =>
              navigation.navigate("ProfileTab", { screen: "Skills" })
            }
          >
            <View style={styles.readinessHeader}>
              <View style={styles.readinessHeaderLeft}>
                <Text style={styles.eyebrow}>SEARCH READINESS</Text>
                <Text style={styles.readinessTitle}>
                  Complete your profile
                </Text>
              </View>
              <View style={styles.readinessPct}>
                <Text style={styles.readinessPctText}>{progress}%</Text>
              </View>
            </View>

            <View style={styles.track}>
              <View
                style={[styles.fill, { width: `${Math.max(progress, 4)}%` }]}
              />
            </View>

            <View style={styles.chipRow}>
              {checklist.map((item) => (
                <View
                  key={item.label}
                  style={[
                    styles.miniChip,
                    item.done ? styles.miniChipDone : styles.miniChipTodo,
                  ]}
                >
                  {item.done ? (
                    <TabBarIcon
                      name="check"
                      color={colors.brand}
                      size={9}
                    />
                  ) : null}
                  <Text
                    style={[
                      styles.miniChipText,
                      item.done
                        ? styles.miniChipTextDone
                        : styles.miniChipTextTodo,
                    ]}
                  >
                    {item.label}
                  </Text>
                </View>
              ))}
            </View>

            <Text style={styles.readinessCta}>
              {progress === 100
                ? "All set — keep your profile fresh. Tap to review."
                : "Tap to finish the missing bits"}
            </Text>
          </Pressable>

          {/* ---------- Quick actions ---------- */}
          <View style={styles.shortcutsRow}>
            <Pressable
              accessibilityRole="button"
              android_ripple={{ color: withAlpha(colors.white, 0.18) }}
              style={({ pressed }) => [
                styles.shortcut,
                styles.shortcutPrimary,
                pressed && styles.cardPressed,
              ]}
              onPress={() => navigation.navigate("FindJobsTab")}
            >
              <View style={[styles.shortcutIcon, styles.shortcutIconOnBrand]}>
                <TabBarIcon name="search" color={colors.white} size={20} />
              </View>
              <Text style={[styles.shortcutTitle, styles.shortcutTitleLight]}>
                Find jobs
              </Text>
              <Text style={[styles.shortcutSub, styles.shortcutSubLight]}>
                Browse openings near you
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              android_ripple={{ color: withAlpha(colors.brand, 0.06) }}
              style={({ pressed }) => [
                styles.shortcut,
                pressed && styles.cardPressed,
              ]}
              onPress={() => navigation.navigate("ApplicationsTab")}
            >
              <View style={styles.shortcutIcon}>
                <TabBarIcon name="file-text" color={colors.brand} size={20} />
              </View>
              <Text style={styles.shortcutTitle}>My applications</Text>
              <Text style={styles.shortcutSub}>
                Track what you've applied to
              </Text>
            </Pressable>
          </View>

          {/* ---------- Featured / boost promo ---------- */}
          <View style={styles.promoCard}>
            <View style={styles.promoTopRow}>
              <View style={styles.promoBadge}>
                <TabBarIcon name="zap" color={colors.gold} size={17} />
              </View>
              <Text style={styles.promoEyebrow}>FEATURED · 7 DAYS</Text>
            </View>

            <Text style={styles.promoTitle}>Boost your profile</Text>
            <Text style={styles.promoCopy}>
              Get a labeled “Featured” placement at the top of employer
              searches for 7 days.
            </Text>

            <Pressable
              accessibilityRole="button"
              android_ripple={{ color: withAlpha(colors.ink, 0.12) }}
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
              <Text style={styles.promoCtaText}>
                Boost — KES 100 / 7 days
              </Text>
            </Pressable>
          </View>

          <LocationPromptCard />

          {/* ---------- Application plans (employer Subscription-plans design) ---------- */}
          <View style={styles.planCard}>
            <View style={styles.planHead}>
              <Text style={styles.planTitle}>Get more applications</Text>
              {ent?.subscription ? (
                <View style={styles.planActivePill}>
                  <Text style={styles.planActiveText}>Active</Text>
                </View>
              ) : null}
            </View>

            {ent?.subscription ? (
              <Text style={styles.planActiveCopy}>
                {ent.subscription.planLabel} · active until{" "}
                {new Date(ent.subscription.expiresAt).toLocaleDateString(
                  "en-KE",
                  {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  }
                )}
                .
              </Text>
            ) : (
              <>
                <Text style={styles.planCopy}>
                  {ent?.credits?.apply > 0
                    ? `${ent.credits.apply} application${
                        ent.credits.apply === 1 ? "" : "s"
                      } ready — or grab a weekly bundle:`
                    : "Your first application is free. After that, bundles keep the search going:"}
                </Text>

                <View style={styles.planRow}>
                  {MAID_PLAN_TILES.map((plan) => (
                    <Pressable
                      key={plan.id}
                      accessibilityRole="button"
                      android_ripple={{ color: withAlpha(colors.brand, 0.08) }}
                      style={({ pressed }) => [
                        styles.planTile,
                        plan.best && styles.planTileBest,
                        pressed && styles.pressedDim,
                      ]}
                      onPress={() =>
                        navigation.navigate("MpesaCheckout", {
                          plan: plan.id,
                          label: plan.label,
                        })
                      }
                    >
                      {plan.best ? (
                        <View style={styles.planBest}>
                          <Text style={styles.planBestText}>Best value</Text>
                        </View>
                      ) : null}
                      <Text style={styles.planName}>{plan.name}</Text>
                      <Text style={styles.planPrice}>KES {plan.price}</Text>
                      <Text style={styles.planPer}>{plan.per}</Text>
                    </Pressable>
                  ))}
                </View>

                <Text style={styles.planFootnote}>
                  Just one role? A single application is KES 50 on any job.
                </Text>
              </>
            )}
          </View>

          {/* ---------- Tips ---------- */}
          <View style={styles.tipsCard}>
            <Text style={styles.eyebrow}>GOOD TO KNOW</Text>
            <Text style={styles.tipsTitle}>Tips to get hired faster</Text>

            <View style={styles.tipRow}>
              <View style={styles.tipNumWrap}>
                <Text style={styles.tipNum}>1</Text>
              </View>
              <Text style={styles.tipText}>
                Use a clear title like "Experienced childcare helper" — vague
                titles get skipped.
              </Text>
            </View>

            <View style={styles.tipRow}>
              <View style={styles.tipNumWrap}>
                <Text style={styles.tipNum}>2</Text>
              </View>
              <Text style={styles.tipText}>
                Mention the areas you can work in; employers search by
                location.
              </Text>
            </View>

            <View style={styles.tipRow}>
              <View style={styles.tipNumWrap}>
                <Text style={styles.tipNum}>3</Text>
              </View>
              <Text style={styles.tipText}>
                A fair hourly rate beats "negotiable" — it builds trust early.
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  /* ---- Shell ---- */
  safeArea: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  bodyScroll: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  body: {
    paddingBottom: 40,
  },
  cardPressed: {
    opacity: 0.9,
  },
  tilePressed: {
    opacity: 0.88,
  },
  pressedDim: {
    opacity: 0.88,
  },
  eyebrow: {
    color: colors.goldDark,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.4,
    marginBottom: 4,
  },

  /* ---- Hero ---- */
  hero: {
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 24,
    overflow: "hidden",
    backgroundColor: colors.cream,
  },
  orb1: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: withAlpha(colors.brand, 0.07),
    top: -110,
    right: -90,
  },
  orb2: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: withAlpha(colors.gold, 0.1),
    top: 40,
    left: -70,
  },
  orb3: {
    position: "absolute",
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: withAlpha(colors.brand, 0.05),
    bottom: -20,
    right: 30,
  },
  kicker: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 2,
    marginBottom: 12,
  },
  karibu: {
    color: colors.ink,
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: -1,
    lineHeight: 38,
    marginBottom: 8,
  },
  lede: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "500",
    maxWidth: "94%",
  },
  readyPill: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: colors.white,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 20,
    borderWidth: 1,
    shadowColor: colors.ink,
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  readyPillOk: {
    borderColor: withAlpha(colors.brand, 0.18),
  },
  readyPillHidden: {
    borderColor: withAlpha(colors.gold, 0.35),
  },
  readyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 5,
  },
  readyDotOk: {
    backgroundColor: colors.brand,
  },
  readyDotHidden: {
    backgroundColor: colors.goldDark,
  },
  readyPillText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700",
  },
  readyPillTextOk: {
    color: colors.brand,
  },
  readyPillTextHidden: {
    color: colors.goldDark,
  },

  /* ---- Content ---- */
  content: {
    paddingHorizontal: 20,
    paddingTop: 4,
  },

  /* ---- Completeness card (compact) ---- */
  readinessCard: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: withAlpha(colors.ink, 0.04),
    shadowColor: colors.ink,
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    marginBottom: 14,
  },
  readinessHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 10,
  },
  readinessHeaderLeft: {
    flex: 1,
  },
  readinessTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  readinessPct: {
    backgroundColor: withAlpha(colors.brand, 0.1),
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  readinessPctText: {
    color: colors.brand,
    fontSize: 12.5,
    fontWeight: "800",
  },
  track: {
    height: 6,
    borderRadius: 999,
    backgroundColor: colors.mist,
    overflow: "hidden",
    marginBottom: 10,
  },
  fill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: colors.brand,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5,
    marginBottom: 10,
  },
  miniChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  miniChipDone: {
    backgroundColor: withAlpha(colors.brand, 0.08),
  },
  miniChipTodo: {
    backgroundColor: colors.cream,
    borderWidth: 1,
    borderColor: withAlpha(colors.ink, 0.08),
  },
  miniChipText: {
    fontSize: 10.5,
    fontWeight: "700",
    lineHeight: 14,
  },
  miniChipTextDone: {
    color: colors.textMuted,
  },
  miniChipTextTodo: {
    color: colors.ink,
  },
  readinessCta: {
    color: colors.brand,
    fontSize: 12,
    fontWeight: "800",
  },

  /* ---- Quick actions ---- */
  shortcutsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 14,
  },
  shortcut: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: 22,
    padding: 16,
    minHeight: 156,
    borderWidth: 1,
    borderColor: withAlpha(colors.ink, 0.04),
    shadowColor: colors.ink,
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  shortcutPrimary: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
    shadowColor: colors.brand,
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  shortcutIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: withAlpha(colors.brand, 0.1),
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  shortcutIconOnBrand: {
    backgroundColor: withAlpha(colors.white, 0.18),
  },
  shortcutTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: -0.2,
    marginBottom: 4,
  },
  shortcutTitleLight: {
    color: colors.white,
  },
  shortcutSub: {
    color: colors.textMuted,
    fontSize: 11.5,
    lineHeight: 16,
    fontWeight: "600",
  },
  shortcutSubLight: {
    color: withAlpha(colors.cream, 0.85),
  },

  /* ---- Featured / boost promo ---- */
  promoCard: {
    backgroundColor: colors.ink,
    borderRadius: 24,
    padding: 18,
    marginBottom: 14,
    overflow: "hidden",
    shadowColor: colors.ink,
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  promoTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  promoBadge: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: withAlpha(colors.gold, 0.18),
    alignItems: "center",
    justifyContent: "center",
  },
  promoEyebrow: {
    color: colors.gold,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.6,
  },
  promoTitle: {
    color: colors.white,
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.4,
    marginBottom: 6,
  },
  promoCopy: {
    color: withAlpha(colors.white, 0.72),
    fontSize: 12.5,
    lineHeight: 19,
    fontWeight: "500",
  },
  promoCta: {
    alignSelf: "flex-start",
    backgroundColor: colors.gold,
    borderRadius: 14,
    minHeight: 44,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
  },
  promoCtaText: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.1,
  },

  /* ---- Weekly plans (original design) ---- */
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
    gap: 8,
  },
  planTitle: {
    color: colors.ink,
    fontSize: 15.5,
    fontWeight: "800",
    flex: 1,
  },
  planActivePill: {
    backgroundColor: withAlpha(colors.brand, 0.14),
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  planActiveText: {
    color: colors.brand,
    fontSize: 10.5,
    fontWeight: "800",
  },
  planActiveCopy: {
    color: colors.textMuted,
    fontSize: 12.5,
    lineHeight: 19,
    marginTop: 8,
  },
  planCopy: {
    color: colors.textMuted,
    fontSize: 12.5,
    lineHeight: 19,
    marginTop: 4,
    marginBottom: 14,
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
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: "center",
  },
  planTileBest: {
    borderColor: colors.gold,
    backgroundColor: withAlpha(colors.gold, 0.1),
  },
  planBest: {
    position: "absolute",
    top: -9,
    backgroundColor: colors.gold,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  planBestText: {
    color: colors.white,
    fontSize: 9.5,
    fontWeight: "800",
  },
  planName: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "800",
  },
  planPrice: {
    color: colors.ink,
    fontSize: 19,
    fontWeight: "800",
    marginTop: 4,
  },
  planPer: {
    color: colors.textFaint,
    fontSize: 10.5,
    fontWeight: "700",
    marginTop: 3,
    textAlign: "center",
  },
  planFootnote: {
    color: colors.textFaint,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 12,
    textAlign: "center",
  },

  /* ---- Tips ---- */
  tipsCard: {
    backgroundColor: colors.white,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: withAlpha(colors.ink, 0.04),
    shadowColor: colors.ink,
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  tipsTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: -0.3,
    marginBottom: 14,
  },
  tipRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 12,
  },
  tipNumWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: withAlpha(colors.brand, 0.1),
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  tipNum: {
    color: colors.brand,
    fontSize: 11,
    fontWeight: "800",
  },
  tipText: {
    flex: 1,
    color: colors.textMuted,
    fontSize: 12.5,
    lineHeight: 19,
    fontWeight: "600",
  },
});