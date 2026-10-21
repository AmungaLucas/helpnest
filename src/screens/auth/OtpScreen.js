import React, { useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  useNavigation,
  useRoute,
} from "@react-navigation/native";

import PrimaryButton from "../../components/ui/PrimaryButton";
import TabBarIcon from "../../components/ui/TabBarIcon";
import HelpNestLogo from "../../components/Logo";
import { useAuth } from "../../context/AuthContext";
import { sendOtp, verifyOtp } from "../../services/authService";
import { formatPhoneDisplay } from "../../utils/phone";
import { colors, withAlpha } from "../../theme/colors";

const RESEND_SECONDS = 60;

export default function OtpScreen() {
  const navigation = useNavigation();
  const { params } = useRoute();
  const { applySession } = useAuth();

  const phone = params?.phone || "";
  const devOtp = params?.devOtp;

  const inputRef = useRef(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState(
    devOtp
      ? "Development mode — your code is shown below."
      : `We sent a 6-digit code to ${formatPhoneDisplay(phone)}.`
  );
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);

  useEffect(() => {
    if (secondsLeft <= 0) return undefined;

    const timer = setInterval(() => {
      setSecondsLeft((s) => s - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [secondsLeft]);

  async function handleVerify() {
    setError("");

    if (!/^\d{6}$/.test(code)) {
      setError("Enter the 6-digit code.");
      return;
    }

    setLoading(true);
    try {
      const data = await verifyOtp(phone, code);

      if (data.success && data.tokens) {
        // Session lands in context; RootNavigator swaps the guest stack for
        // the authed stack, which unmounts this screen and opens Main. No
        // explicit navigation needed — a reset dispatched here would target
        // the guest stack, where "Main" doesn't exist.
        applySession({ tokens: data.tokens, userData: data.user });
        return;
      }

      setError(data.message || "Verification failed. Please try again.");
    } catch (err) {
      setError(
        err?.message || "Verification failed. Please check the code and try again."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setResending(true);
    setError("");
    setInfo("");

    try {
      const data = await sendOtp(phone);
      setSecondsLeft(RESEND_SECONDS);
      setCode("");
      setInfo(
        data.devOtp
          ? `Development mode — your code is ${data.devOtp}.`
          : data.message || "A new code is on its way."
      );
    } catch (err) {
      setError(err?.message || "Could not resend the code. Please try again.");
    } finally {
      setResending(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.cream} />

      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        <View style={styles.inner}>
          <View style={styles.topBlock}>
            <HelpNestLogo size={54} style={styles.brandLogo} />

            <Text style={styles.eyebrow}>PHONE VERIFICATION</Text>
            <Text style={styles.title}>Enter your code</Text>
            <Text style={styles.subtitle}>{info}</Text>

            {devOtp ? (
              <View style={styles.devBox}>
                <Text style={styles.devText}>DEV CODE: {devOtp}</Text>
              </View>
            ) : null}

            <TextInput
              ref={inputRef}
              style={styles.codeInput}
              keyboardType="number-pad"
              maxLength={6}
              autoFocus
              value={code}
              onChangeText={(value) => setCode(value.replace(/\D/g, ""))}
              placeholder="• • • • • •"
              placeholderTextColor={colors.cloud}
            />

            {error ? (
              <View style={styles.errorBox}>
                <View style={styles.errorRow}>
                  <TabBarIcon
                    name="alert-triangle"
                    color={colors.danger}
                    size={15}
                  />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              </View>
            ) : null}
          </View>

          <View style={styles.bottomBlock}>
            <PrimaryButton
              label="Verify and continue"
              onPress={handleVerify}
              loading={loading}
            />

            {secondsLeft > 0 ? (
              <View style={styles.resendRow}>
                <TabBarIcon name="clock" color={colors.textFaint} size={13} />
                <Text style={styles.resendIdle}>
                  Resend code in {secondsLeft}s
                </Text>
              </View>
            ) : (
              <View style={styles.resendRow}>
                <TabBarIcon
                  name="refresh-cw"
                  color={colors.brand}
                  size={13}
                />
                <Text
                  style={styles.resendLink}
                  onPress={resending ? undefined : handleResend}
                >
                  {resending ? "Sending…" : "Didn't get it? Resend code"}
                </Text>
              </View>
            )}

            <Text style={styles.backLink} onPress={() => navigation.goBack()}>
              Use a different number
            </Text>
          </View>
        </View>
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
  inner: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 28,
  },
  topBlock: {
    marginTop: "auto",
  },
  bottomBlock: {
    marginTop: "auto",
    paddingTop: 26,
  },

  /* ---- Brand + header ---- */
  brandLogo: {
    alignSelf: "center",
    marginBottom: 20,
  },
  eyebrow: {
    color: colors.goldDark,
    fontSize: 10.5,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 10,
    textAlign: "center",
  },
  title: {
    color: colors.ink,
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.6,
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 22,
    textAlign: "center",
  },

  /* ---- Dev + code ---- */
  devBox: {
    backgroundColor: withAlpha(colors.gold, 0.12),
    borderWidth: 1,
    borderColor: withAlpha(colors.gold, 0.5),
    borderRadius: 12,
    padding: 12,
    marginBottom: 18,
    alignItems: "center",
  },
  devText: {
    color: colors.goldDark,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  codeInput: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.mistDark,
    borderRadius: 18,
    minHeight: 68,
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: 14,
    textAlign: "center",
    color: colors.ink,
    marginBottom: 16,
    shadowColor: colors.ink,
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },

  /* ---- Error ---- */
  errorBox: {
    backgroundColor: withAlpha(colors.danger, 0.08),
    borderRadius: 12,
    padding: 12,
    marginBottom: 6,
  },
  errorRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600",
    textAlign: "center",
    flexShrink: 1,
  },

  /* ---- Resend ---- */
  resendRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 18,
  },
  resendIdle: {
    color: colors.textFaint,
    fontSize: 12.5,
    lineHeight: 17,
    fontWeight: "600",
  },
  resendLink: {
    color: colors.brand,
    fontSize: 13,
    fontWeight: "800",
  },
  backLink: {
    color: colors.textMuted,
    fontSize: 12.5,
    lineHeight: 17,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 24,
    textDecorationLine: "underline",
  },
});
