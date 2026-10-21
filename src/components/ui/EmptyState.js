import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import TabBarIcon from "./TabBarIcon";
import { colors, withAlpha } from "../../theme/colors";

/**
 * EmptyState — the standard v3 empty / error / placeholder block.
 *
 *   <EmptyState icon="file-text" title="No jobs yet"
 *     body="Jobs you post will show up here."
 *     actionLabel="Post your first job" onAction={...} />
 *
 * `tone` : "brand" (default) | "gold" | "danger"
 */
const TONES = {
  brand: { bg: withAlpha(colors.brand, 0.1), fg: colors.brand },
  gold: { bg: withAlpha(colors.gold, 0.16), fg: colors.goldDark },
  danger: { bg: withAlpha(colors.danger, 0.1), fg: colors.danger },
};

export default function EmptyState({
  icon = "info",
  title,
  body,
  actionLabel,
  onAction,
  tone = "brand",
  compact = false,
}) {
  const t = TONES[tone] || TONES.brand;
  const badgeSize = compact ? 52 : 64;

  return (
    <View style={styles.wrap}>
      <View
        style={[
          styles.badge,
          { width: badgeSize, height: badgeSize, borderRadius: badgeSize * 0.31, backgroundColor: t.bg },
        ]}
      >
        <TabBarIcon name={icon} color={t.fg} size={compact ? 22 : 26} />
      </View>

      {title ? <Text style={styles.title}>{title}</Text> : null}
      {body ? <Text style={styles.body}>{body}</Text> : null}

      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button"
          onPress={onAction}
          style={({ pressed }) => [styles.action, pressed && styles.pressed]}
          android_ripple={{ color: withAlpha(colors.brand, 0.1) }}
        >
          <Text style={styles.actionLabel}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 30,
    paddingHorizontal: 24,
  },
  badge: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  title: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.2,
    textAlign: "center",
    marginBottom: 7,
  },
  body: {
    color: colors.textMuted,
    fontSize: 13.5,
    lineHeight: 20,
    textAlign: "center",
  },
  action: {
    marginTop: 18,
    backgroundColor: colors.brand,
    borderRadius: 14,
    minHeight: 48,
    paddingHorizontal: 22,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  pressed: {
    opacity: 0.88,
  },
  actionLabel: {
    color: colors.white,
    fontSize: 14,
    fontWeight: "800",
  },
});
