import React from "react";
import { Pressable, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { DrawerActions } from "@react-navigation/native";
import Svg, { Line } from "react-native-svg";

import { colors } from "../../theme/colors";

// Opens the profile drawer from any screen nested inside it. On the tabs
// that are NOT inside the drawer the dispatch is a harmless no-op.
export default function HamburgerButton({ color = colors.ink, size = 22 }) {
  const navigation = useNavigation();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Open menu"
      onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
      hitSlop={12}
      style={styles.hit}
    >
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Line
          x1="3"
          y1="6"
          x2="21"
          y2="6"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
        />
        <Line
          x1="3"
          y1="12"
          x2="21"
          y2="12"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
        />
        <Line
          x1="3"
          y1="18"
          x2="21"
          y2="18"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
        />
      </Svg>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hit: {
    padding: 4,
    alignSelf: "flex-start",
  },
});
