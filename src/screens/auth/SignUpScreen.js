import React, { useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";

import TextField from "../../components/ui/TextField";
import PrimaryButton from "../../components/ui/PrimaryButton";
import TabBarIcon from "../../components/ui/TabBarIcon";
import HelpNestLogo from "../../components/Logo";
import { signUp } from "../../services/authService";
import { isValidEmail, normalizePhone } from "../../utils/phone";
import { colors, withAlpha } from "../../theme/colors";

const ROLE_LABELS = {
  employer: "Employer",
  domestic_worker: "Domestic Worker",
};

export default function SignUpScreen() {
  const navigation = useNavigation();
  const { params } = useRoute();
  const insets = useSafeAreaInsets();

  // Role comes from the RoleSelector ("employer" | "domestic_worker");
  // the API expects the PRD's enum value ("maid").
  const role = params?.role === "domestic_worker" ? "maid" : "employer";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [locationLabel, setLocationLabel] = useState("");
  const [password, setPassword] = useState("");
  const [referralCode, setReferralCode] = useState("");

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
        // Optional invite code — the friend who shared it earns cash once
        // this account makes its first payment (see Account > Referrals).
        referralCode: referralCode.trim().toUpperCase() || undefined,
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
        // "padding" on both platforms — under Android edge-to-edge the
        // legacy resize mode no longer lifts the form above the keyboard.
        behavior="padding"
      >
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingBottom: 32 + insets.bottom },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ---- Brand moment ---- */}
          <View style={styles.brandBlock}>
            <HelpNestLogo size={56} style={styles.brandLogo} />
            <Text style={styles.eyebrow}>STEP 2 OF 2 · CREATE ACCOUNT</Text>
            <Text style={styles.title}>
              Join HelpNest as a {roleLabel}
            </Text>
            <Text style={styles.subtitle}>
              A few details and your account is ready.
            </Text>
          </View>

          {/* ---- Form card ---- */}
          <View style={[styles.card, styles.cardShadow]}>
            <View style={styles.fields}>
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

              <TextField
                label="Referral code (optional)"
                placeholder="e.g. K7QW2M"
                autoCapitalize="characters"
                value={referralCode}
                onChangeText={(v) => setReferralCode(v.toUpperCase())}
                hint="Got a code from a friend? They earn a cash reward when you pay."
              />
            </View>

            {formError ? (
              <View style={styles.errorBox}>
                <View style={styles.errorRow}>
                  <TabBarIcon
                    name="alert-triangle"
                    color={colors.danger}
                    size={15}
                  />
                  <Text style={styles.errorText}>{formError}</Text>
                </View>
              </View>
            ) : null}
          </View>

          {/* ---- CTA pinned toward the bottom ---- */}
          <View style={styles.ctaBlock}>
            <PrimaryButton
              label="Create account"
              onPress={handleSubmit}
              loading={loading}
            />

            <View style={styles.termsRow}>
              <TabBarIcon name="lock" color={colors.textFaint} size={12} />
              <Text style={styles.terms}>
                By creating an account you agree to our Terms of Service and
                Privacy Policy.
              </Text>
            </View>
          </View>

          <View style={styles.linksBlock}>
            <Text style={styles.loginLink}>
              Already have an account?{" "}
              <Text
                style={styles.loginLinkBold}
                onPress={() => navigation.navigate("Login")}
              >
                Log in
              </Text>
            </Text>

            <Text style={styles.changeRoleLink}>
              Not this role?{" "}
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
    paddingTop: 24,
    paddingBottom: 32,
  },

  /* ---- Brand moment ---- */
  brandBlock: {
    alignItems: "center",
    marginBottom: 24,
  },
  brandLogo: {
    marginBottom: 16,
  },
  eyebrow: {
    color: colors.goldDark,
    fontSize: 10.5,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  title: {
    color: colors.ink,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "800",
    letterSpacing: -0.6,
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
  },

  /* ---- Card ---- */
  card: {
    backgroundColor: colors.white,
    borderRadius: 22,
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
  errorRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600",
    flexShrink: 1,
  },

  /* ---- CTA ---- */
  ctaBlock: {
    marginTop: "auto",
    paddingTop: 28,
  },
  termsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 14,
    paddingHorizontal: 8,
  },
  terms: {
    color: colors.textFaint,
    fontSize: 11.5,
    lineHeight: 17,
    fontWeight: "600",
    flexShrink: 1,
  },

  /* ---- Links ---- */
  linksBlock: {
    marginTop: 24,
  },
  loginLink: {
    color: colors.textMuted,
    fontSize: 13.5,
    lineHeight: 20,
    textAlign: "center",
  },
  loginLinkBold: {
    color: colors.brand,
    fontWeight: "800",
  },
  changeRoleLink: {
    color: colors.textFaint,
    fontSize: 12.5,
    lineHeight: 17,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 10,
  },
  changeRoleBold: {
    color: colors.goldDark,
    fontWeight: "800",
  },
});
