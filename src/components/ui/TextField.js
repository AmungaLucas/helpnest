import React, { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import Svg, { Circle, Line, Path } from "react-native-svg";

import { colors } from "../../theme/colors";

// Feather-style eye icons drawn inline with react-native-svg (already a
// project dependency via the logo), so no extra icon package is needed.
function EyeIcon({ off }) {
  const stroke = {
    stroke: colors.textMuted,
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  };

  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      {off ? (
        <>
          <Path
            d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"
            {...stroke}
          />
          <Line x1="1" y1="1" x2="23" y2="23" {...stroke} />
        </>
      ) : (
        <>
          <Path
            d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"
            {...stroke}
          />
          <Circle cx="12" cy="12" r="3" {...stroke} />
        </>
      )}
    </Svg>
  );
}

// Consistent labelled text input used across the auth flow.
// Any field created with `secureTextEntry` automatically gets a
// show/hide password toggle on its trailing edge.
export default function TextField({
  label,
  hint,
  error,
  value,
  onChangeText,
  secureTextEntry,
  ...inputProps
}) {
  const [visible, setVisible] = useState(false);
  const isPassword = Boolean(secureTextEntry);

  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      <View>
        <TextInput
          style={[
            styles.input,
            isPassword ? styles.inputWithToggle : null,
            error ? styles.inputError : null,
          ]}
          placeholderTextColor={colors.textMuted}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={isPassword ? !visible : false}
          {...inputProps}
        />

        {isPassword ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={visible ? "Hide password" : "Show password"}
            accessibilityState={{ selected: visible }}
            onPress={() => setVisible((v) => !v)}
            style={styles.toggle}
            hitSlop={8}
          >
            <EyeIcon off={visible} />
          </Pressable>
        ) : null}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!error && hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 16,
  },
  label: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 7,
  },
  input: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.mistDark,
    borderRadius: 12,
    paddingHorizontal: 14,
    minHeight: 50,
    fontSize: 15,
    color: colors.ink,
  },
  inputWithToggle: {
    paddingRight: 48,
  },
  toggle: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  inputError: {
    borderColor: "#C24136",
  },
  error: {
    color: "#C24136",
    fontSize: 12,
    marginTop: 6,
  },
  hint: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 6,
  },
});
