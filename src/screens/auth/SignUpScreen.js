import React, { useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";

import TextField from "../../components/ui/TextField";
import PrimaryButton from "../../components/ui/PrimaryButton";
import { signUp } from "../../services/authService";
import { isValidEmail, normalizePhone } from "../../utils/phone";
import { colors } from "../../theme/colors";

const ROLE_LABELS = {
  employer: "Employer",
  domestic_worker: "Domestic Worker",
};

export default function SignUpScreen() {
  const navigation = useNavigation();
  const { params } = useRoute();

  // Role comes from the RoleSelector ("employer" | "domestic_worker");
  // the API expects the PRD's enum value ("maid").
  const role = params?.role === "domestic_worker" ? "maid" : "employer";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [locationLabel, setLocationLabel] = useState("");
  const [password, setPassword] = useState("");

  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);

  const roleLabel = useMemo(() => ROLE_LABELS[params?.role] || "Employer", [params]);

  function validate() {
    const next = {};

    if (name.trim().length < 3) {
      next.name = "Enter your full name (at least 3 characters).";
    }
    if (!isValidEmail(email)) {
      next.email = "Enter a valid email address.";
    }
    if (!normalizePhone(phone)) {
      next.phone = "Enter a valid Kenyan number, e.g. 0712 345 678.";
    }
    if (password.length < 8) {
      next.password = "Use at least 8 characters.";
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit() {
    setFormError("");

    if (!validate()) return;

    setLoading(true);
    try {
      const data = await signUp({
        role,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: normalizePhone(phone),
        password,
        locationLabel: locationLabel.trim(),
      });

      if (data.requiresOtp) {
        navigation.navigate("OtpVerify", {
          phone: data.phone,
          devOtp: data.devOtp,
        });
        return;
      }

      navigation.navigate("Login");
    } catch (err) {
      setFormError(
        err?.message ||
          "Could not create your account. Please check your connection and try again."
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
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.eyebrow}>STEP 2 OF 2 · CREATE ACCOUNT</Text>
          <Text style={styles.title}>
            Join HelpNest as a {roleLabel}
          </Text>

          <View style={styles.card}>
            <TextField
              label="Full name"
              placeholder="e.g. Grace Wanjiku"
              autoCapitalize="words"
              value={name}
              onChangeText={setName}
              error={errors.name}
            />

            <TextField
              label="Email"
              placeholder="you@example.com"
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              error={errors.email}
            />

            <TextField
              label="Phone number"
              placeholder="0712 345 678"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
              error={errors.phone}
              hint="We'll send a 6-digit code to verify it."
            />

            <TextField
              label="Location (area you live or work)"
              placeholder="e.g. Kilimani, Nairobi"
              autoCapitalize="words"
              value={locationLabel}
              onChangeText={setLocationLabel}
              hint="Approximate area only — never your exact address."
            />

            <TextField
              label="Password"
              placeholder="At least 8 characters"
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
              label="Create account"
              onPress={handleSubmit}
              loading={loading}
            />

            <Text style={styles.terms}>
              By creating an account you agree to our Terms of Service and
              Privacy Policy.
            </Text>
          </View>

          <Text style={styles.loginLink}>
            Already have an account?{" "}
            <Text
              style={styles.loginLinkBold}
              onPress={() => navigation.navigate("Login")}
            >
              Log in
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
    paddingBottom: 40,
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
  terms: {
    color: colors.textMuted,
    fontSize: 11.5,
    lineHeight: 17,
    textAlign: "center",
    marginTop: 14,
  },
  loginLink: {
    color: colors.textMuted,
    fontSize: 13.5,
    textAlign: "center",
    marginTop: 20,
  },
  loginLinkBold: {
    color: colors.brand,
    fontWeight: "800",
  },
});
