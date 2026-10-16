import React, { useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";

import PrimaryButton from "../../components/ui/PrimaryButton";
import { useAuth } from "../../context/AuthContext";
import { sendOtp, verifyOtp } from "../../services/authService";
import { formatPhoneDisplay } from "../../utils/phone";
import { colors } from "../../theme/colors";

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
        applySession({ tokens: data.tokens, userData: data.user });
        navigation.reset({ index: 0, routes: [{ name: "Home" }] });
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

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.inner}>
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
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <PrimaryButton
            label="Verify and continue"
            onPress={handleVerify}
            loading={loading}
          />

          {secondsLeft > 0 ? (
            <Text style={styles.resendIdle}>
              Resend code in {secondsLeft}s
            </Text>
          ) : (
            <Text
              style={styles.resendLink}
              onPress={resending ? undefined : handleResend}
            >
              {resending ? "Sending…" : "Didn't get it? Resend code"}
            </Text>
          )}

          <Text style={styles.backLink} onPress={() => navigation.goBack()}>
            Use a different number
          </Text>
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
    padding: 22,
    justifyContent: "center",
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
    fontWeight: "800",
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 24,
  },
  devBox: {
    backgroundColor: "#FFF7E0",
    borderWidth: 1,
    borderColor: colors.gold,
    borderRadius: 12,
    padding: 12,
    marginBottom: 18,
  },
  devText: {
    color: colors.goldDark,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  codeInput: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.mistDark,
    borderRadius: 14,
    minHeight: 60,
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: 12,
    textAlign: "center",
    color: colors.ink,
    marginBottom: 16,
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
  resendIdle: {
    color: colors.textFaint,
    fontSize: 13,
    textAlign: "center",
    marginTop: 18,
  },
  resendLink: {
    color: colors.brand,
    fontSize: 13,
    fontWeight: "800",
    textAlign: "center",
    marginTop: 18,
  },
  backLink: {
    color: colors.textMuted,
    fontSize: 12.5,
    textAlign: "center",
    marginTop: 26,
    textDecorationLine: "underline",
  },
});
