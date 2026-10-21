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
import TabBarIcon from "../../components/ui/TabBarIcon";
import HelpNestLogo from "../../components/Logo";
import { useAuth } from "../../context/AuthContext";
import { login } from "../../services/authService";
import { isValidEmail, normalizePhone } from "../../utils/phone";
import { colors, withAlpha } from "../../theme/colors";

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
        // Session lands in context; RootNavigator swaps the guest stack for
        // the authed stack, which unmounts this screen and opens Main.
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
          {/* ---- Brand moment ---- */}
          <View style={styles.brandBlock}>
            <HelpNestLogo size={62} style={styles.brandLogo} />
            <Text style={styles.eyebrow}>WELCOME BACK</Text>
            <Text style={styles.title}>Log in to HelpNest</Text>
            <Text style={styles.subtitle}>
              Pick up right where you left off.
            </Text>
          </View>

          {/* ---- Form card ---- */}
          <View style={[styles.card, styles.cardShadow]}>
            <View style={styles.fields}>
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
            </View>

            {formError ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{formError}</Text>
              </View>
            ) : null}
          </View>

          {/* ---- CTA pinned toward the bottom ---- */}
          <View style={styles.ctaBlock}>
            <PrimaryButton
              label="Log in"
              onPress={handleSubmit}
              loading={loading}
            />

            <View style={styles.trustRow}>
              <TabBarIcon name="lock" color={colors.textFaint} size={13} />
              <Text style={styles.trustText}>
                Private and secure — only you can access your account.
              </Text>
            </View>
          </View>

          <View style={styles.linksBlock}>
            <Text style={styles.signupLink}>
              New to HelpNest?{" "}
              <Text
                style={styles.signupLinkBold}
                onPress={() => navigation.navigate("RoleSelector")}
              >
                Create an account
              </Text>
            </Text>

            <Text style={styles.changeRoleLink}>
              Picked the wrong role?{" "}
              <Text
                style={styles.changeRoleBold}
                onPress={() => navigation.navigate("RoleSelector")}
              >
                Change role
              </Text>
            </Text>
          </View>
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
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 32,
  },

  /* ---- Brand moment ---- */
  brandBlock: {
    alignItems: "center",
    marginBottom: 26,
  },
  brandLogo: {
    marginBottom: 18,
  },
  eyebrow: {
    color: colors.goldDark,
    fontSize: 10.5,
    fontWeight: "800",
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  title: {
    color: colors.ink,
    fontSize: 27,
    lineHeight: 33,
    fontWeight: "800",
    letterSpacing: -0.4,
    marginBottom: 8,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
  },

  /* ---- Card ---- */
  card: {
    backgroundColor: colors.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.mist,
    padding: 20,
  },
  cardShadow: {
    shadowColor: colors.ink,
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 1,
  },
  fields: {
    gap: 6,
  },
  errorBox: {
    backgroundColor: withAlpha(colors.danger, 0.08),
    borderRadius: 12,
    padding: 12,
    marginTop: 14,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600",
  },

  /* ---- CTA ---- */
  ctaBlock: {
    marginTop: "auto",
    paddingTop: 24,
  },
  trustRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 14,
  },
  trustText: {
    color: colors.textFaint,
    fontSize: 11.5,
    fontWeight: "600",
  },

  /* ---- Links ---- */
  linksBlock: {
    marginTop: 24,
  },
  signupLink: {
    color: colors.textMuted,
    fontSize: 13.5,
    textAlign: "center",
  },
  signupLinkBold: {
    color: colors.brand,
    fontWeight: "800",
  },
  changeRoleLink: {
    color: colors.textFaint,
    fontSize: 12.5,
    textAlign: "center",
    marginTop: 10,
  },
  changeRoleBold: {
    color: colors.goldDark,
    fontWeight: "800",
  },
});
