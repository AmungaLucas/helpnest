import React from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";

import { colors } from "../../theme/colors";

// Consistent labelled text input used across the auth flow.
export default function TextField({
  label,
  hint,
  error,
  value,
  onChangeText,
  ...inputProps
}) {
  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      <TextInput
        style={[styles.input, error ? styles.inputError : null]}
        placeholderTextColor={colors.textMuted}
        value={value}
        onChangeText={onChangeText}
        {...inputProps}
      />

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
