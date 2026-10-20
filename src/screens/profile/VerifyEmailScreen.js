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
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Verify your email</Text>
        <View style={styles.backSpace} />
      </View>

      <View style={styles.body}>
        <Text style={styles.lede}>
          {email
            ? `We sent a 6-digit code to ${email}. Enter it below to verify your email address.`
            : "Enter the 6-digit code we emailed you."}
        </Text>

        {msg ? <Text style={styles.msg}>{msg}</Text> : null}
        {err ? <Text style={styles.err}>{err}</Text> : null}

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
          style={[styles.primaryBtn, (busy || code.length !== 6) && styles.btnDisabled]}
          onPress={submit}
          disabled={busy || code.length !== 6}
        >
          {busy ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.primaryBtnText}>Verify email</Text>
          )}
        </Pressable>

        <Pressable
          accessibilityRole="button"
          style={styles.resendBtn}
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  backText: { fontSize: 30, color: colors.brand, fontWeight: "700", marginTop: -4 },
  backSpace: { width: 40 },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 17, fontWeight: "700", color: colors.brand },
  body: { flex: 1, paddingHorizontal: 24, paddingTop: 18 },
  lede: { fontSize: 15, color: colors.ink, lineHeight: 22, marginBottom: 14 },
  msg: { fontSize: 13, color: colors.brand, marginBottom: 6, fontWeight: "600" },
  err: { fontSize: 13, color: colors.danger, marginBottom: 6, fontWeight: "600" },
  codeInput: {
    borderWidth: 1.5,
    borderColor: withAlpha(colors.brand, 0.35),
    borderRadius: 14,
    backgroundColor: colors.white,
    fontSize: 28,
    letterSpacing: 12,
    textAlign: "center",
    paddingVertical: 14,
    color: colors.ink,
    marginBottom: 18,
  },
  primaryBtn: {
    backgroundColor: colors.brand,
    borderRadius: 14,
    alignItems: "center",
    paddingVertical: 15,
  },
  btnDisabled: { opacity: 0.45 },
  primaryBtnText: { color: colors.white, fontWeight: "800", fontSize: 16 },
  resendBtn: { alignItems: "center", paddingVertical: 16 },
  resendText: { color: colors.brand, fontWeight: "700", fontSize: 14 },
  resendWait: { color: colors.textMuted, opacity: 0.6 },
  note: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 18,
    marginTop: 6,
    textAlign: "center",
  },
});
