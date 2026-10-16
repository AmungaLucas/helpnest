import React from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { colors } from "../theme/colors";

/**
 * The house + heart mark on its own (no badge background).
 * Used inside badges and tiny avatars.
 */
export function HelpNestLogoMark({ size = 24, strokeWidth = 7 }) {
  return (
    <Svg viewBox="0 0 100 100" width={size} height={size}>
      {/* Roof */}
      <Path
        d="M 16 50 L 50 20 L 84 50"
        stroke={colors.brand}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Body / walls */}
      <Path
        d="M 26 50 L 26 84 L 74 84 L 74 50"
        stroke={colors.brand}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Heart */}
      <Path
        d="M 50 74 C 41 66 34 60 34 53 C 34 47 39 43 44 43 C 47 43 49 45 50 48 C 51 45 53 43 56 43 C 61 43 66 47 66 53 C 66 60 59 66 50 74 Z"
        fill={colors.gold}
      />
    </Svg>
  );
}

/**
 * Cream rounded badge with the HelpNest mark inside.
 * size = badge edge length (the mark fills 75% of it).
 */
export default function HelpNestLogo({ size = 52, style }) {
  const badgeRadius = size * 0.31; // keeps the splash proportions (88 -> 27)
  const iconSize = size * 0.75;

  return (
    <View
      style={[
        styles.badge,
        { width: size, height: size, borderRadius: badgeRadius },
        style,
      ]}
    >
      <HelpNestLogoMark size={iconSize} />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    backgroundColor: colors.cream,
    alignItems: "center",
    justifyContent: "center",
  },
});
