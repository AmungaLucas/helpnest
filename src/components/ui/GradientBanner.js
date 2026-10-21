import React from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

import { colors } from "../../theme/colors";

/**
 * GradientBanner — brand gradient surface for hero moments (referral hero,
 * checkout amount band, profile header band). Uses react-native-svg's
 * LinearGradient, which is already a project dependency, so no new npm
 * packages are introduced.
 *
 *   <GradientBanner style={{ height: 180, borderRadius: 24 }}>
 *     <Text>...hero content...</Text>
 *   </GradientBanner>
 */
export default function GradientBanner({ children, style, from = colors.brand, to = "#163828" }) {
  return (
    <View style={[styles.wrap, style]}>
      {/* absolutely-positioned gradient rect stretches with the container */}
      <Svg style={StyleSheet.absoluteFill} preserveAspectRatio="none" viewBox="0 0 100 100">
        <Defs>
          <LinearGradient id="hnBrandGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={from} />
            <Stop offset="1" stopColor={to} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100" height="100" fill="url(#hnBrandGrad)" />
      </Svg>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    overflow: "hidden",
    backgroundColor: colors.brand,
  },
});
