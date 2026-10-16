/**
 * HelpNest brand palette.
 *
 * Single source of truth for every color used in the app.
 * Use `withAlpha()` for translucent variants instead of hardcoding rgba() strings.
 */

export const colors = {
  /* Brand */
  brand: "#214E3B", // deep forest green — primary surfaces, buttons, active states
  brandSoft: "#7BC08B", // fresh green — live indicators / success accents
  cream: "#F7F3E9", // warm cream — light backgrounds and badges
  gold: "#D6A64F", // honey gold — brand accent (heart, highlights, footer)
  goldDark: "#9A742D", // deep gold — eyebrows and inline links

  /* Neutrals (green-tinted) */
  ink: "#26312B", // headings and primary text
  textMuted: "#69746C", // secondary / description text
  textFaint: "#8C968E", // footnotes
  mist: "#E5EBE5", // dividers, tag chips, avatar background
  mistDark: "#C9D2CA", // stronger borders on mist surfaces
  cloud: "#D6DCD6", // grabber, oversized row numbers
  linen: "#ECE6D8", // assistant bubble border
  white: "#FFFFFF", // pure white — cards and on-brand text
};

/**
 * Convert a hex color to an rgba() string with the given opacity.
 * Example: withAlpha(colors.cream, 0.12) -> "rgba(247, 243, 233, 0.12)"
 */
export function withAlpha(hex, alpha) {
  const value = hex.replace("#", "");
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
