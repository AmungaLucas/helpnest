/**
 * HelpNest "Modern v3" design tokens.
 *
 * Companion to the color palette module in the same folder (which stays the
 * single source of truth for COLOR — the launch-crash scanner parses that
 * file's palette, so do not move or reformat it). Everything layout/typography/elevation lives
 * here so the six UI agents and future screens compose from one scale.
 *
 * Usage:
 *   import { theme } from "../theme/theme";
 *   theme.radius.card, theme.shadow.card, theme.text.h1 ...
 */

import { colors } from "./colors";

export const theme = {
  /* Spacing scale (4pt grid) */
  space: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20, // default screen gutter
    xxl: 24,
    xxxl: 32,
  },

  /* Corner radii */
  radius: {
    chip: 10,
    button: 14,
    field: 14,
    card: 20,
    hero: 24,
    sheet: 26,
    squircle: 13, // 40-44px icon tiles
    avatar: 18,
    pill: 999,
  },

  /* Soft elevation — one shadow recipe per surface tier */
  shadow: {
    card: {
      shadowColor: colors.ink,
      shadowOpacity: 0.06,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 5 },
      elevation: 1,
    },
    raised: {
      shadowColor: colors.ink,
      shadowOpacity: 0.1,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 3,
    },
    float: {
      shadowColor: colors.ink,
      shadowOpacity: 0.14,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 10 },
      elevation: 6,
    },
  },

  /* Type scale — the only allowed font sizes/weights in v3 screens */
  text: {
    display: { fontSize: 28, fontWeight: "800", letterSpacing: -0.6, color: colors.ink },
    h1: { fontSize: 23, fontWeight: "800", letterSpacing: -0.4, color: colors.ink },
    h2: { fontSize: 17.5, fontWeight: "800", letterSpacing: -0.2, color: colors.ink },
    title: { fontSize: 15.5, fontWeight: "700", color: colors.ink },
    body: { fontSize: 14, lineHeight: 21, color: colors.textMuted },
    caption: { fontSize: 12.5, lineHeight: 17, fontWeight: "600", color: colors.textMuted },
    micro: { fontSize: 11, fontWeight: "700", color: colors.textFaint },
    eyebrow: {
      fontSize: 10.5,
      fontWeight: "800",
      letterSpacing: 1.2,
      textTransform: "uppercase",
      color: colors.goldDark,
    },
  },

  /* Touch targets */
  hit: {
    button: 54,
    buttonSm: 48,
    iconTile: 42,
    row: 56,
  },

  /* Brand gradient stops (render with react-native-svg, already installed —
     see components/ui/GradientBanner.js). No new dependencies allowed. */
  gradient: {
    brand: [colors.brand, "#163828"], // deep forest -> darker forest
    gold: [colors.gold, "#B8863B"],
  },
};

export default theme;
