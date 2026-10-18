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
import { HelpNestLogoMark } from "../../components/Logo";
import LocationPromptCard from "../../components/ui/LocationPromptCard";
import TabBarIcon from "../../components/ui/TabBarIcon";
import { colors, withAlpha } from "../../theme/colors";

// Maid home (PRD §5.2): get the worker search-ready and into work fast.
export default function MaidHomeScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();

  const [profile, setProfile] = useState(null);

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
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <View style={styles.logoBadge}>
            <HelpNestLogoMark size={22} />
          </View>
          <Text style={styles.brandText}>HelpNest</Text>
        </View>
        <View style={styles.headerPill}>
          <Text style={styles.headerPillText}>Domestic Worker</Text>
        </View>
      </View>

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
          style={styles.progressCard}
          onPress={() => navigation.navigate("ProfileTab", { screen: "Skills" })}
        >
          <View style={styles.progressTopRow}>
            <Text style={styles.progressTitle}>Complete your profile</Text>
            <Text style={styles.progressValue}>{progress}%</Text>
          </View>

          <View style={styles.track}>
            <View style={[styles.fill, { width: `${Math.max(progress, 4)}%` }]} />
          </View>

          <View style={styles.checklist}>
            {checklist.map((item) => (
              <View key={item.label} style={styles.checkRow}>
                <View style={[styles.checkDot, item.done && styles.checkDotDone]}>
                  {item.done ? (
                    <TabBarIcon name="check" color={colors.white} size={10} />
                  ) : null}
                </View>
                <Text
                  style={[styles.checkLabel, item.done && styles.checkLabelDone]}
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
            size={16}
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
            style={({ pressed }) => [
              styles.actionCard,
              styles.actionPrimary,
              pressed && styles.cardPressed,
            ]}
            onPress={() => navigation.navigate("FindJobsTab")}
          >
            <TabBarIcon name="search" color={colors.white} size={19} />
            <Text style={[styles.actionTitle, styles.actionTitleLight]}>
              Find jobs
            </Text>
            <Text style={[styles.actionText, styles.actionTextLight]}>
              Browse openings near you
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.actionCard,
              pressed && styles.cardPressed,
            ]}
            onPress={() => navigation.navigate("ApplicationsTab")}
          >
            <TabBarIcon name="file-text" color={colors.brand} size={19} />
            <Text style={styles.actionTitle}>My applications</Text>
            <Text style={styles.actionText}>
              Track what you've applied to
            </Text>
          </Pressable>
        </View>

        <LocationPromptCard />

        {/* ---------- Tips ---------- */}
        <View style={styles.tipsCard}>
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
  safeArea: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  header: {
    backgroundColor: colors.brand,
    paddingHorizontal: 22,
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
    backgroundColor: withAlpha(colors.cream, 0.16),
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  headerPillText: {
    color: colors.cream,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  bodyScroll: {
    flex: 1,
  },
  body: {
    padding: 22,
    paddingBottom: 36,
  },
  karibu: {
    color: colors.ink,
    fontSize: 26,
    fontWeight: "800",
    marginBottom: 6,
  },
  lede: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 18,
  },

  /* ---- Completeness card ---- */
  progressCard: {
    backgroundColor: colors.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.mist,
    padding: 18,
    marginBottom: 14,
  },
  progressTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  progressTitle: {
    color: colors.ink,
    fontSize: 15.5,
    fontWeight: "800",
  },
  progressValue: {
    color: colors.brand,
    fontSize: 16,
    fontWeight: "800",
  },
  track: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.mist,
    overflow: "hidden",
    marginBottom: 14,
  },
  fill: {
    height: "100%",
    borderRadius: 4,
    backgroundColor: colors.brand,
  },
  checklist: {
    marginBottom: 6,
  },
  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
  },
  checkDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.mist,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 9,
  },
  checkDotDone: {
    backgroundColor: colors.brandSoft,
  },
  checkLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "600",
  },
  checkLabelDone: {
    color: colors.ink,
  },
  progressCta: {
    color: colors.brand,
    fontSize: 12.5,
    fontWeight: "800",
    marginTop: 8,
  },

  /* ---- Search-ready status ---- */
  readyCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    padding: 14,
    gap: 10,
    marginBottom: 18,
  },
  readyOk: {
    backgroundColor: withAlpha(colors.brand, 0.1),
  },
  readyHidden: {
    backgroundColor: withAlpha(colors.gold, 0.13),
  },
  readyText: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 18,
    fontWeight: "600",
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
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.mist,
    padding: 15,
    minHeight: 112,
  },
  actionPrimary: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  cardPressed: {
    opacity: 0.85,
  },
  actionTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "800",
    marginTop: 9,
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

  /* ---- Tips ---- */
  tipsCard: {
    backgroundColor: colors.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.mist,
    padding: 16,
    marginTop: 4,
  },
  tipsTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 8,
  },
  tipLine: {
    color: colors.textMuted,
    fontSize: 12.5,
    lineHeight: 19,
    marginBottom: 6,
  },
});
