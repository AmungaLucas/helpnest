import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";

import TextField from "../../components/ui/TextField";
import PrimaryButton from "../../components/ui/PrimaryButton";
import { useAuth } from "../../context/AuthContext";
import { login } from "../../services/authService";
import { isValidEmail, normalizePhone } from "../../utils/phone";
import { colors } from "../../theme/colors";

export default function LoginScreen() {
  const navigation = useNavigation();
  const { applySession } = useAuth();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);

  function validate() {
    const next = {};

    const trimmed = identifier.trim();
    const looksLikePhone = /^(\+?254|0)[17]/.test(trimmed.replace(/[\s-]/g, ""));

    if (looksLikePhone) {
      if (!normalizePhone(trimmed)) {
        next.identifier = "Enter a valid Kenyan number, e.g. 0712 345 678.";
      }
    } else if (!isValidEmail(trimmed)) {
      next.identifier = "Enter your phone number or email.";
    }

    if (!password) {
      next.password = "Enter your password.";
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit() {
    setFormError("");

    if (!validate()) return;

    setLoading(true);
    try {
      const data = await login(identifier.trim(), password);

      if (data.requiresOtp) {
        navigation.navigate("OtpVerify", {
          phone: data.phone,
          devOtp: data.devOtp,
        });
        return;
      }

      if (data.success && data.tokens) {
        // RootNavigator remounts onto Home as soon as the session lands.
        applySession({ tokens: data.tokens, userData: data.user });
        return;
      }

      setFormError(data.message || "Login failed. Please try again.");
    } catch (err) {
      setFormError(
        err?.message || "Could not log in. Please check your connection and try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.cream} />

      <KeyboardAvoidingView
        style={styles.flex}
        // "padding" on both platforms — under Android edge-to-edge the
        // legacy resize mode no longer lifts the form above the keyboard.
        behavior="padding"
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.eyebrow}>WELCOME BACK</Text>
          <Text style={styles.title}>Log in to HelpNest</Text>

          <View style={styles.card}>
            <TextField
              label="Phone number or email"
              placeholder="0712 345 678 or you@example.com"
              autoCapitalize="none"
              keyboardType="email-address"
              value={identifier}
              onChangeText={setIdentifier}
              error={errors.identifier}
            />

            <TextField
              label="Password"
              placeholder="Your password"
              secureTextEntry
              autoCapitalize="none"
              value={password}
              onChangeText={setPassword}
              error={errors.password}
            />

            {formError ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{formError}</Text>
              </View>
            ) : null}

            <PrimaryButton
              label="Log in"
              onPress={handleSubmit}
              loading={loading}
            />
          </View>

          <Text style={styles.signupLink}>
            New to HelpNest?{" "}
            <Text
              style={styles.signupLinkBold}
              onPress={() => navigation.navigate("RoleSelector")}
            >
              Create an account
            </Text>
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  flex: {
    flex: 1,
  },
  scroll: {
    padding: 22,
    paddingBottom: 60,
  },
  eyebrow: {
    color: colors.goldDark,
    fontSize: 10.5,
    fontWeight: "800",
    letterSpacing: 1.4,
    marginBottom: 10,
  },
  title: {
    color: colors.ink,
    fontSize: 25,
    lineHeight: 31,
    fontWeight: "800",
    letterSpacing: -0.3,
    marginBottom: 18,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.mist,
    padding: 18,
  },
  errorBox: {
    backgroundColor: "#FFF0EE",
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  errorText: {
    color: "#7D2922",
    fontSize: 13,
    lineHeight: 19,
  },
  signupLink: {
    color: colors.textMuted,
    fontSize: 13.5,
    textAlign: "center",
    marginTop: 20,
  },
  signupLinkBold: {
    color: colors.brand,
    fontWeight: "800",
  },
});
