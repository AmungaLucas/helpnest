import React from "react";
import { Pressable, StyleSheet, Text } from "react-native";

import { colors, withAlpha } from "../../theme/colors";

// Small pill toggle used for services, availability and filters.
export default function Chip({ label, selected, disabled, onPress }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: Boolean(selected) }}
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      style={[
        styles.chip,
        selected && styles.chipSelected,
        disabled && styles.chipDisabled,
      ]}
    >
      <Text style={[styles.label, selected && styles.labelSelected]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderWidth: 1,
    borderColor: colors.mistDark,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
    marginBottom: 8,
    backgroundColor: colors.white,
  },
  chipSelected: {
    backgroundColor: withAlpha(colors.brand, 0.12),
    borderColor: colors.brand,
  },
  chipDisabled: {
    opacity: 0.5,
  },
  label: {
    color: colors.ink,
    fontSize: 12.5,
    fontWeight: "600",
  },
  labelSelected: {
    color: colors.brand,
    fontWeight: "800",
  },
});
