import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  StatusBar,
  Alert,
  ScrollView,
  LayoutAnimation,
  Platform,
  UIManager,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import HelpNestLogo, { HelpNestLogoMark } from "../components/Logo";
import { colors, withAlpha } from "../theme/colors";

// LayoutAnimation is a silent no-op on Android unless explicitly enabled.
if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

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

export default function RoleSelectorScreen() {
  const [selectedRole, setSelectedRole] = useState(null);
  const selected = ROLES.find((role) => role.id === selectedRole);

  function chooseRole(id) {
    LayoutAnimation.configureNext(
      LayoutAnimation.create(
        260,
        LayoutAnimation.Types.easeInEaseOut,
        LayoutAnimation.Properties.opacity
      )
    );
    setSelectedRole(id);
  }

  function handleContinue() {
    Alert.alert(
      "Welcome to HelpNest",
      `You selected ${selected.short}. We'll set up your account next.`
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.brand} />

      {/* ================= HERO ================= */}
      <View style={styles.hero}>
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
      </View>

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
            <View style={styles.divider} />

            {ROLES.map((role) => {
              const isSelected = selectedRole === role.id;

              return (
                <View key={role.id}>
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityState={{ checked: isSelected }}
                    onPress={() => chooseRole(role.id)}
                    style={({ pressed }) => [
                      styles.row,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.number,
                        isSelected && styles.numberSelected,
                      ]}
                    >
                      {role.number}
                    </Text>

                    <View style={styles.rowBody}>
                      <Text style={styles.rowTitle}>{role.title}</Text>
                      <Text style={styles.rowDescription}>
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
                        styles.marker,
                        isSelected && styles.markerSelected,
                      ]}
                    >
                      {isSelected ? (
                        <Text style={styles.markerCheck}>✓</Text>
                      ) : null}
                    </View>
                  </Pressable>

                  <View style={styles.divider} />
                </View>
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
              </View>
            </View>
          ) : null}

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
    backgroundColor: colors.brand,
    paddingBottom: 34,
    overflow: "hidden",
  },
  heroSafe: {
    paddingHorizontal: 24,
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
    paddingHorizontal: 24,
    paddingTop: 14,
    paddingBottom: 30,
  },
  eyebrow: {
    color: colors.goldDark,
    fontSize: 10.5,
    fontWeight: "800",
    letterSpacing: 1.4,
    marginBottom: 10,
  },
  title: {
    color: colors.ink,
    fontSize: 25,
    lineHeight: 31,
    fontWeight: "800",
    letterSpacing: -0.3,
    marginBottom: 18,
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
    width: 28,
    height: 28,
    borderRadius: 14,
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
    lineHeight: 20,
    marginBottom: 4,
  },
  bubbleTextLast: {
    marginBottom: 0,
  },
  bubbleTextLight: {
    color: colors.cream,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
  },

  /* ---------- OPTIONS ---------- */
  options: {
    marginTop: 4,
  },
  divider: {
    height: 1,
    backgroundColor: colors.mist,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 20,
  },
  pressed: {
    opacity: 0.7,
  },
  number: {
    width: 52,
    fontSize: 34,
    lineHeight: 40,
    fontWeight: "300",
    letterSpacing: -1,
    color: colors.cloud,
    marginRight: 10,
  },
  numberSelected: {
    color: colors.brand,
    fontWeight: "400",
  },
  rowBody: {
    flex: 1,
    paddingTop: 2,
  },
  rowTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 5,
  },
  rowDescription: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
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
    borderRadius: 999,
    backgroundColor: colors.mist,
  },
  tagText: {
    color: colors.brand,
    fontSize: 11,
    fontWeight: "700",
  },
  marker: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.mistDark,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 10,
    marginTop: 6,
  },
  markerSelected: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  markerCheck: {
    color: colors.cream,
    fontSize: 13,
    fontWeight: "900",
  },

  /* ---------- REPLY + CTA ---------- */
  replyBlock: {
    marginTop: 22,
  },
  ctaWrap: {
    marginTop: 18,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 56,
    borderRadius: 16,
    backgroundColor: colors.brand,
  },
  buttonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: "700",
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
    fontWeight: "700",
    textDecorationLine: "underline",
  },

  footnote: {
    color: colors.textFaint,
    fontSize: 11,
    lineHeight: 17,
    textAlign: "center",
    marginTop: 26,
    paddingHorizontal: 12,
  },
});