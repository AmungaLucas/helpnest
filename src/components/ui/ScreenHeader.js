import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";

import TabBarIcon from "./TabBarIcon";
import HamburgerButton from "./HamburgerButton";
import { colors, withAlpha } from "../../theme/colors";

/**
 * ScreenHeader — the standard v3 top bar for every non-tab screen.
 *
 * Replaces the bespoke back-rows each screen used to roll by hand, so the
 * whole app shares one header anatomy: 40px squircle action button, 17.5px
 * title, optional right slot, white surface with a hairline mist border.
 *
 *   <ScreenHeader title="Post a job" />                        // back only
 *   <ScreenHeader title="Notifications" right={<Bell/>} />     // + right slot
 *   <ScreenHeader title="Menu" leading="hamburger" />          // drawer screens
 *
 * `leading` : "back" (default) | "hamburger" | "none"
 * `onBack`  : optional override; defaults to navigation.goBack().
 * `tone`    : "surface" (white bar) | "canvas" (cream, borderless)
 */
export default function ScreenHeader({
  title,
  subtitle,
  eyebrow,
  leading = "back",
  onBack,
  right = null,
  tone = "surface",
  style,
}) {
  const navigation = useNavigation();

  const surface = tone === "surface";

  return (
    <View
      style={[
        styles.bar,
        surface ? styles.barSurface : styles.barCanvas,
        style,
      ]}
    >
      <View style={styles.leadingSlot}>
        {leading === "back" ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={onBack || (() => navigation.goBack())}
            hitSlop={8}
            style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
            android_ripple={{
              color: withAlpha(colors.brand, 0.1),
              borderless: false,
              radius: 22,
            }}
          >
            <TabBarIcon name="chevron-left" color={colors.ink} size={21} />
          </Pressable>
        ) : null}
        {leading === "hamburger" ? <HamburgerButton /> : null}
      </View>

      <View style={styles.titleWrap} pointerEvents="none">
        {eyebrow ? <Text style={styles.eyebrow} numberOfLines={1}>{eyebrow}</Text> : null}
        {title ? <Text style={styles.title} numberOfLines={1}>{title}</Text> : null}
        {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
      </View>

      <View style={styles.rightSlot}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    minHeight: 60,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingTop: 4,
    paddingBottom: 6,
  },
  barSurface: {
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.mist,
  },
  barCanvas: {
    backgroundColor: "transparent",
  },
  leadingSlot: {
    minWidth: 44,
    alignItems: "flex-start",
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: colors.mist,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  pressed: {
    opacity: 0.88,
  },
  titleWrap: {
    flex: 1,
    marginHorizontal: 8,
  },
  eyebrow: {
    color: colors.goldDark,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 1,
  },
  title: {
    color: colors.ink,
    fontSize: 17.5,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "600",
    marginTop: 1,
  },
  rightSlot: {
    minWidth: 44,
    alignItems: "flex-end",
  },
});
