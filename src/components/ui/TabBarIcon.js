import React from "react";
import Svg, { Circle, Line, Path, Rect } from "react-native-svg";

// Feather-style stroke icons for the bottom tab bar (react-native-svg,
// already a project dependency — no icon package needed).
const ICON_PATHS = {
  home: (
    <>
      <Path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <Path d="M9 22V12h6v10" />
    </>
  ),
  search: (
    <>
      <Circle cx="11" cy="11" r="8" />
      <Line x1="21" y1="21" x2="16.65" y2="16.65" />
    </>
  ),
  work: (
    <>
      <Rect x="2" y="7" width="20" height="14" rx="2" />
      <Path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </>
  ),
  chat: <Path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
  user: (
    <>
      <Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <Circle cx="12" cy="7" r="4" />
    </>
  ),
};

export default function TabBarIcon({ name, focused, color, size = 22 }) {
  const strokeProps = {
    stroke: color,
    strokeWidth: focused ? 2.2 : 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    fill: "none",
  };

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {React.Children.map(ICON_PATHS[name], (child) =>
        child ? React.cloneElement(child, strokeProps) : null
      )}
    </Svg>
  );
}
