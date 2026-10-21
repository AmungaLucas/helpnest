import React, { useState } from "react";
import { useNavigation } from "@react-navigation/native";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  StatusBar,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import HelpNestLogo, { HelpNestLogoMark } from "../components/Logo";
import TabBarIcon from "../components/ui/TabBarIcon";
import GradientBanner from "../components/ui/GradientBanner";
import { colors, withAlpha } from "../theme/colors";

const ROLES = [
  {
    id: "employer",
    number: "01",
    title: "I'm an Employer",
    short: "Employer",
    description: "Find trusted domestic workers for your home.",
    reply: "I'm an Employer",
    tags: ["Post jobs", "Review profiles", "Hire securely"],
  },
  {
    id: "domestic_worker",
    number: "02",
    title: "I'm a Domestic Worker",
    short: "Domestic Worker",
    description: "Discover job opportunities and build your profile.",
    reply: "I'm a Domestic Worker",
    tags: ["Build profile", "Get discovered", "Grow your work"],
  },
];

// Tinted icon badge per role (visual only).
const ROLE_ICONS = {
  employer: { icon: "work", tint: colors.brand, bg: withAlpha(colors.brand, 0.1) },
  domestic_worker: {
    icon: "user",
    tint: colors.goldDark,
    bg: withAlpha(colors.gold, 0.16),
  },
};

export default function RoleSelectorScreen() {
  const navigation = useNavigation();
  const [selectedRole, setSelectedRole] = useState(null);
  const selected = ROLES.find((role) => role.id === selectedRole);

  function chooseRole(id) {
    // Note: LayoutAnimation was removed — it is a no-op under the New
    // Architecture (Expo SDK 57 default). If the expand/collapse needs
    // animating later, use react-native-reanimated layout animations.
    setSelectedRole(id);
  }

  function handleContinue() {
    // PRD §5.1/§5.2: role selection flows straight into basic signup.
    navigation.navigate("SignUp", { role: selected.id });
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.brand} />

      {/* ================= HERO ================= */}
      <GradientBanner style={styles.hero}>
        <SafeAreaView edges={["top"]} style={styles.heroSafe}>
          <View style={styles.heroRow}>
            <HelpNestLogo size={52} style={styles.heroLogo} />

            <View style={styles.heroText}>
              <Text style={styles.heroTagline}>
                Trusted people. Happier homes.
              </Text>

              <View style={styles.statusPill}>
                <View style={styles.statusDot} />
                <Text style={styles.statusText}>Here to help</Text>
              </View>
            </View>
          </View>
        </SafeAreaView>

        <View style={styles.orbGold} />
        <View style={styles.orbCream} />
      </GradientBanner>

      {/* ================= SHEET ================= */}
      <View style={styles.sheet}>
        <View style={styles.grabber} />

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
        >
          <Text style={styles.eyebrow}>STEP 1 OF 2 · WELCOME</Text>
          <Text style={styles.title}>How will you use HelpNest?</Text>

          <Message from="assistant">
            <Text style={styles.bubbleText}>
              Hi there 👋 Take your time. Pick the option that fits
              you best — you can change this later.
            </Text>
          </Message>

          <View style={styles.options}>
            {ROLES.map((role) => {
              const isSelected = selectedRole === role.id;
              const badge = ROLE_ICONS[role.id];

              return (
                <Pressable
                  key={role.id}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: isSelected }}
                  onPress={() => chooseRole(role.id)}
                  android_ripple={{ color: withAlpha(colors.brand, 0.08) }}
                  style={({ pressed }) => [
                    styles.roleCard,
                    isSelected && styles.roleCardSelected,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={[styles.roleBadge, { backgroundColor: badge.bg }]}>
                    <TabBarIcon name={badge.icon} color={badge.tint} size={20} />
                  </View>

                  <View style={styles.roleBody}>
                    <Text style={styles.roleTitle}>{role.title}</Text>
                    <Text style={styles.roleDescription}>
                      {role.description}
                    </Text>

                    {isSelected ? (
                      <View style={styles.tags}>
                        {role.tags.map((tag) => (
                          <View key={tag} style={styles.tag}>
                            <Text style={styles.tagText}>{tag}</Text>
                          </View>
                        ))}
                      </View>
                    ) : null}
                  </View>

                  <View
                    style={[
                      styles.trailing,
                      isSelected && styles.trailingSelected,
                    ]}
                  >
                    <TabBarIcon
                      name={isSelected ? "check" : "chevron-right"}
                      color={isSelected ? colors.cream : colors.textFaint}
                      size={isSelected ? 15 : 17}
                    />
                  </View>
                </Pressable>
              );
            })}
          </View>

          {selected ? (
            <View style={styles.replyBlock}>
              <Message from="user">
                <Text style={styles.bubbleTextLight}>
                  {selected.reply}
                </Text>
              </Message>

              <Message from="assistant">
                <Text style={styles.bubbleText}>
                  Great — {selected.short.toLowerCase()} it is. 🎉
                </Text>
                <Text style={[styles.bubbleText, styles.bubbleTextLast]}>
                  Let's get your account ready.
                </Text>
              </Message>

              <View style={styles.ctaWrap}>
                <Pressable
                  accessibilityRole="button"
                  onPress={handleContinue}
                  android_ripple={{ color: withAlpha(colors.brand, 0.08) }}
                  style={({ pressed }) => [
                    styles.button,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.buttonText}>
                    Continue as {selected.short}
                  </Text>
                  <Text style={styles.buttonArrow}>→</Text>
                </Pressable>

                <Pressable
                  onPress={() => setSelectedRole(null)}
                  style={styles.changeWrap}
                >
                  <Text style={styles.changeText}>Change my answer</Text>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  onPress={() => navigation.navigate("Login")}
                  style={styles.changeWrap}
                >
                  <Text style={styles.changeText}>
                    Already have an account? Log in
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          <View style={styles.footnoteRow}>
            <View style={styles.footnoteBadge}>
              <TabBarIcon name="shield-check" color={colors.brand} size={16} />
            </View>
          </View>
          <Text style={styles.footnote}>
            Everyone is welcome. Verification helps build trust
            across the HelpNest community.
          </Text>
        </ScrollView>
      </View>
    </View>
  );
}

/* ---------- Chat message ---------- */
function Message({ from, children }) {
  const isUser = from === "user";

  return (
    <View style={[styles.messageRow, isUser && styles.messageRowUser]}>
      {!isUser ? (
        <View style={styles.avatar}>
          <HelpNestLogoMark size={16} strokeWidth={9} />
        </View>
      ) : null}

      <View
        style={[
          styles.bubble,
          isUser ? styles.bubbleUser : styles.bubbleAssistant,
        ]}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.brand,
  },

  /* ---------- HERO ---------- */
  hero: {
    paddingBottom: 34,
  },
  heroSafe: {
    paddingHorizontal: 20,
    paddingTop: 4,
  },
  heroRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 8,
  },
  heroLogo: {
    marginRight: 14,
  },
  heroText: {
    flex: 1,
  },
  heroTagline: {
    color: withAlpha(colors.cream, 0.85),
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
    letterSpacing: 0.3,
    marginBottom: 8,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: withAlpha(colors.cream, 0.12),
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.brandSoft,
    marginRight: 6,
  },
  statusText: {
    color: withAlpha(colors.cream, 0.9),
    fontSize: 10.5,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  orbGold: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: withAlpha(colors.gold, 0.14),
    left: -80,
    bottom: -90,
  },
  orbCream: {
    position: "absolute",
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: withAlpha(colors.cream, 0.06),
    right: -20,
    top: 10,
  },

  /* ---------- SHEET ---------- */
  sheet: {
    flex: 1,
    backgroundColor: colors.cream,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    marginTop: -20,
    paddingTop: 10,
  },
  grabber: {
    alignSelf: "center",
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.cloud,
    marginBottom: 4,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
  },
  eyebrow: {
    color: colors.goldDark,
    fontSize: 10.5,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  title: {
    color: colors.ink,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "800",
    letterSpacing: -0.6,
    marginBottom: 20,
  },

  /* ---------- MESSAGES ---------- */
  messageRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginBottom: 14,
    maxWidth: "90%",
  },
  messageRowUser: {
    alignSelf: "flex-end",
    justifyContent: "flex-end",
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.mist,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  bubble: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    maxWidth: "100%",
  },
  bubbleAssistant: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 18,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    borderWidth: 1,
    borderColor: colors.linen,
    shadowColor: colors.ink,
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  bubbleUser: {
    backgroundColor: colors.brand,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 4,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
  },
  bubbleText: {
    color: colors.ink,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 4,
  },
  bubbleTextLast: {
    marginBottom: 0,
  },
  bubbleTextLight: {
    color: colors.cream,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "600",
  },

  /* ---------- ROLE CARDS ---------- */
  options: {
    marginTop: 4,
    gap: 14,
  },
  roleCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.mist,
    padding: 18,
    shadowColor: colors.ink,
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 1,
  },
  roleCardSelected: {
    borderColor: colors.brand,
    backgroundColor: colors.white,
    shadowOpacity: 0.08,
    elevation: 2,
  },
  pressed: {
    opacity: 0.88,
  },
  roleBadge: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  roleBody: {
    flex: 1,
  },
  roleTitle: {
    color: colors.ink,
    fontSize: 17.5,
    fontWeight: "800",
    letterSpacing: -0.2,
    marginBottom: 4,
  },
  roleDescription: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
  },
  tags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 12,
  },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: withAlpha(colors.brand, 0.08),
  },
  tagText: {
    color: colors.brand,
    fontSize: 11,
    fontWeight: "700",
  },
  trailing: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.mist,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 12,
  },
  trailingSelected: {
    backgroundColor: colors.brand,
  },

  /* ---------- REPLY + CTA ---------- */
  replyBlock: {
    marginTop: 24,
  },
  ctaWrap: {
    marginTop: 20,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 56,
    borderRadius: 16,
    backgroundColor: colors.brand,
    overflow: "hidden",
    shadowColor: colors.ink,
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 1,
  },
  buttonText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: "800",
  },
  buttonArrow: {
    color: colors.white,
    fontSize: 20,
    marginLeft: 10,
    fontWeight: "700",
  },
  changeWrap: {
    alignSelf: "center",
    marginTop: 14,
  },
  changeText: {
    color: colors.goldDark,
    fontSize: 12.5,
    lineHeight: 17,
    fontWeight: "700",
    textDecorationLine: "underline",
  },

  /* ---------- FOOTNOTE ---------- */
  footnoteRow: {
    alignItems: "center",
    marginTop: 26,
    marginBottom: 10,
  },
  footnoteBadge: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: withAlpha(colors.brand, 0.08),
    alignItems: "center",
    justifyContent: "center",
  },
  footnote: {
    color: colors.textFaint,
    fontSize: 11.5,
    lineHeight: 17,
    fontWeight: "600",
    textAlign: "center",
    paddingHorizontal: 12,
  },
});
