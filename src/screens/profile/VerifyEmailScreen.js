import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";

import ScreenHeader from "../../components/ui/ScreenHeader";
import TabBarIcon from "../../components/ui/TabBarIcon";
import { colors, withAlpha } from "../../theme/colors";
import {
  confirmEmailVerification,
  requestEmailVerification,
} from "../../services/authService";

// Email verification (PRD v1.1 §4.2/§4.3): a 6-digit code lands in the
// user's inbox and is confirmed here. Required before KYC can approve the
// account to `verified` (phone + email + ID review).
export default function VerifyEmailScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const emailFromRoute = route?.params?.email || "";

  const [code, setCode] = useState("");
  const [email, setEmail] = useState(emailFromRoute);
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);
  const [cooldown, setCooldown] = useState(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const t = setTimeout(() => {
      if (mounted.current) setCooldown((c) => c - 1);
    }, 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const send = useCallback(async () => {
    if (sending || cooldown > 0) return;
    setSending(true);
    setErr(null);
    setMsg(null);
    try {
      const d = await requestEmailVerification();
      if (!mounted.current) return;
      setEmail(d.email || emailFromRoute);
      setMsg(d.message || "Check your inbox for the code.");
      setCooldown(60);
    } catch (e) {
      if (mounted.current) setErr(e.message || "Could not send the code.");
    } finally {
      if (mounted.current) setSending(false);
    }
  }, [cooldown, emailFromRoute, sending]);

  // Fire the first code on entry.
  useEffect(() => {
    send();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = useCallback(async () => {
    if (busy || code.trim().length !== 6) return;
    setBusy(true);
    setErr(null);
    try {
      const d = await confirmEmailVerification(code.trim());
      if (!mounted.current) return;
      Alert.alert("Email verified", d.message || "Thank you!", [
        { text: "Done", onPress: () => navigation.goBack() },
      ]);
    } catch (e) {
      if (mounted.current) {
        setErr(e.message || "That code did not work.");
        setCode("");
      }
    } finally {
      if (mounted.current) setBusy(false);
    }
  }, [busy, code, navigation]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.cream} />

      <ScreenHeader title="Verify your email" leading="back" tone="surface" />

      <View style={styles.body}>
        <View style={styles.heroBadge}>
          <TabBarIcon name="send" color={colors.brand} size={26} />
        </View>
        <Text style={styles.lede}>
          {email
            ? `We sent a 6-digit code to ${email}. Enter it below to verify your email address.`
            : "Enter the 6-digit code we emailed you."}
        </Text>

        {msg ? (
          <View style={styles.msgBox}>
            <Text style={styles.msg}>{msg}</Text>
          </View>
        ) : null}
        {err ? (
          <View style={styles.errBox}>
            <Text style={styles.err}>{err}</Text>
          </View>
        ) : null}

        <TextInput
          style={styles.codeInput}
          value={code}
          onChangeText={(t) => setCode(t.replace(/[^0-9]/g, "").slice(0, 6))}
          keyboardType="number-pad"
          maxLength={6}
          placeholder="• • • • • •"
          placeholderTextColor={withAlpha(colors.brand, 0.35)}
          autoFocus
        />

        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.primaryBtn,
            (busy || code.length !== 6) && styles.btnDisabled,
            pressed && !busy && code.length === 6 && styles.pressed,
          ]}
          onPress={submit}
          disabled={busy || code.length !== 6}
          android_ripple={{ color: withAlpha(colors.white, 0.18) }}
        >
          {busy ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.primaryBtnText}>Verify email</Text>
          )}
        </Pressable>

        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [styles.resendBtn, pressed && styles.pressed]}
          onPress={send}
          disabled={sending || cooldown > 0}
        >
          {sending ? (
            <ActivityIndicator size="small" color={colors.brand} />
          ) : (
            <Text style={[styles.resendText, cooldown > 0 && styles.resendWait]}>
              {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
            </Text>
          )}
        </Pressable>

        <Text style={styles.note}>
          Email verification is one of the three checks needed for the
          verified badge (with phone OTP and your ID review). It also speeds
          up refunds and support.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.cream },
  pressed: { opacity: 0.88 },
  body: { flex: 1, paddingHorizontal: 20, paddingTop: 20 },
  heroBadge: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: withAlpha(colors.brand, 0.12),
    borderWidth: 1,
    borderColor: withAlpha(colors.brand, 0.14),
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 16,
  },
  lede: {
    fontSize: 14.5,
    color: colors.ink,
    lineHeight: 22,
    textAlign: "center",
    alignSelf: "center",
    maxWidth: 320,
    marginBottom: 18,
  },
  msgBox: {
    backgroundColor: withAlpha(colors.brand, 0.1),
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  msg: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.brand,
    fontWeight: "700",
  },
  errBox: {
    backgroundColor: withAlpha(colors.danger, 0.07),
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  err: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.danger,
    fontWeight: "700",
  },
  codeInput: {
    borderWidth: 1.5,
    borderColor: withAlpha(colors.brand, 0.35),
    borderRadius: 16,
    backgroundColor: colors.white,
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: 10,
    textAlign: "center",
    paddingVertical: 16,
    color: colors.ink,
    marginTop: 4,
    marginBottom: 18,
  },
  primaryBtn: {
    backgroundColor: colors.brand,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 54,
    paddingVertical: 15,
    overflow: "hidden",
    shadowColor: colors.ink,
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 1,
  },
  btnDisabled: { opacity: 0.45 },
  primaryBtnText: { color: colors.white, fontWeight: "800", fontSize: 16 },
  resendBtn: { alignItems: "center", paddingVertical: 16 },
  resendText: { color: colors.brand, fontWeight: "800", fontSize: 14 },
  resendWait: { color: colors.textMuted, opacity: 0.6 },
  note: {
    fontSize: 12.5,
    color: colors.textMuted,
    lineHeight: 18,
    marginTop: 10,
    textAlign: "center",
    alignSelf: "center",
    maxWidth: 320,
  },
});
