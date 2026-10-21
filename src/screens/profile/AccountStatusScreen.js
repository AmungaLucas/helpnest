import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import TabBarIcon from "../../components/ui/TabBarIcon";
import PrimaryButton from "../../components/ui/PrimaryButton";
import { colors, withAlpha } from "../../theme/colors";
import { useAuth } from "../../context/AuthContext";
import { fileAppeal } from "../../services/appealsService";

// PRD §3.2/§15.6 — the fail-closed account states. Rendered INSTEAD of the
// whole app while AuthContext.accountBlocked is set (the gateway answers
// 403 { banned: true } / { suspended: true } on any blocked request).
//
//   banned    — no activity at all: explanation + support address + sign out
//   suspended — the gateway keeps /api/appeals open, so this screen carries
//               the appeal form (kind: account_suspension) inline
export default function AccountStatusScreen() {
  const { accountBlocked, acknowledgeBlocked, clearSession } = useAuth();

  const status = accountBlocked?.status || "banned";
  const gatewayMessage = accountBlocked?.message || "";
  const isBanned = status === "banned";

  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState(null);

  const signOut = useCallback(() => {
    acknowledgeBlocked();
    clearSession();
  }, [acknowledgeBlocked, clearSession]);

  const submitAppeal = useCallback(async () => {
    if (busy || note.trim().length < 20) return;
    setBusy(true);
    setErr(null);
    try {
      await fileAppeal({ kind: "account_suspension", message: note.trim() });
      setSent(true);
    } catch (e) {
      setErr(e.message || "Could not file the appeal. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  }, [busy, note]);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={colors.cream}
      />
      <View style={styles.body}>
        <View
          style={[
            styles.badge,
            {
              backgroundColor: isBanned ? withAlpha(colors.danger, 0.1) : withAlpha(colors.gold, 0.14),
              borderColor: isBanned ? withAlpha(colors.danger, 0.18) : withAlpha(colors.gold, 0.28),
            },
          ]}
        >
          {/* "slash" isn't in the approved TabBarIcon set — "user-x" carries
              the blocked-account semantics on the sanctioned list. */}
          <TabBarIcon
            name={isBanned ? "user-x" : "clock"}
            color={isBanned ? colors.danger : colors.goldDark}
            size={30}
          />
        </View>

        <Text style={styles.title}>
          {isBanned ? "Account disabled" : "Account suspended"}
        </Text>
        <Text style={styles.lede}>
          {isBanned
            ? "Your account was permanently disabled for breaking HelpNest's rules. Sessions, chats and bookings are closed."
            : "Your account is on hold while our team looks into a reported issue. You can't use the app until it's resolved."}
        </Text>

        {gatewayMessage ? (
          <View
            style={[
              styles.noteBox,
              isBanned
                ? { backgroundColor: withAlpha(colors.danger, 0.06) }
                : { backgroundColor: withAlpha(colors.gold, 0.08) },
            ]}
          >
            <Text style={[styles.noteText, { color: isBanned ? colors.danger : colors.goldDark }]}>
              {gatewayMessage}
            </Text>
          </View>
        ) : null}

        {!isBanned ? (
          <View style={styles.card}>
            <Text style={styles.eyebrow}>APPEAL</Text>
            <Text style={styles.cardTitle}>Think this is a mistake?</Text>
            <Text style={styles.cardBody}>
              Tell us what happened. A second reviewer who was not part of the
              original decision reads every appeal within 72 hours.
            </Text>

            {sent ? (
              <View style={styles.sentBox}>
                <TabBarIcon name="check-circle" color={colors.brand} size={18} />
                <Text style={styles.sentText}>
                  Appeal received. We'll notify you in the app once it's decided.
                </Text>
              </View>
            ) : (
              <>
                <TextInput
                  style={styles.input}
                  value={note}
                  onChangeText={(t) => setNote(t.slice(0, 2000))}
                  multiline
                  placeholder="Describe what happened (at least 20 characters)…"
                  placeholderTextColor={colors.textFaint}
                />
                {err ? <Text style={styles.err}>{err}</Text> : null}
                <View style={styles.appealBtn}>
                  <PrimaryButton
                    label="Send appeal"
                    onPress={submitAppeal}
                    loading={busy}
                    disabled={note.trim().length < 20}
                  />
                </View>
              </>
            )}
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.eyebrow}>NEED HELP?</Text>
            <Text style={styles.cardBody}>
              If you believe this was a mistake, email{" "}
              <Text style={styles.mail}>support@jobready.co.ke</Text> with your
              registered phone number. Our team can review the decision.
            </Text>
          </View>
        )}

        <View style={styles.footer}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sign out"
            style={({ pressed }) => [styles.signOut, pressed && styles.pressed]}
            onPress={signOut}
          >
            <TabBarIcon name="x" color={colors.textMuted} size={16} />
            <Text style={styles.signOutText}>Sign out of this device</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.cream },
  pressed: { opacity: 0.88 },
  body: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 28,
  },
  badge: {
    width: 68,
    height: 68,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
  },
  title: {
    fontSize: 23,
    fontWeight: "800",
    color: colors.ink,
    textAlign: "center",
    marginTop: 16,
    letterSpacing: -0.4,
  },
  lede: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.textMuted,
    textAlign: "center",
    marginTop: 8,
  },
  noteBox: {
    borderRadius: 16,
    padding: 14,
    marginTop: 14,
  },
  noteText: { fontSize: 13, fontWeight: "700", lineHeight: 19 },
  card: {
    backgroundColor: colors.white,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.mist,
    padding: 20,
    marginTop: 18,
    shadowColor: colors.ink,
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 1,
  },
  eyebrow: {
    fontSize: 10.5,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: colors.goldDark,
    marginBottom: 6,
  },
  cardTitle: {
    fontSize: 17.5,
    fontWeight: "800",
    color: colors.ink,
    marginBottom: 6,
  },
  cardBody: {
    fontSize: 13.5,
    lineHeight: 20,
    color: colors.textMuted,
  },
  mail: { color: colors.brand, fontWeight: "700" },
  input: {
    borderWidth: 1.5,
    borderColor: colors.mist,
    borderRadius: 16,
    backgroundColor: colors.cream,
    padding: 12,
    minHeight: 96,
    textAlignVertical: "top",
    fontSize: 14,
    color: colors.ink,
    marginTop: 12,
  },
  err: {
    color: colors.danger,
    fontSize: 12.5,
    fontWeight: "700",
    marginTop: 8,
  },
  appealBtn: { marginTop: 12 },
  sentBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: withAlpha(colors.brand, 0.08),
    borderRadius: 16,
    padding: 12,
    marginTop: 12,
  },
  sentText: {
    flex: 1,
    color: colors.brand,
    fontWeight: "700",
    fontSize: 13,
    lineHeight: 19,
  },
  footer: { marginTop: "auto", paddingTop: 18 },
  signOut: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 48,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.mist,
    borderRadius: 14,
    paddingVertical: 12,
  },
  signOutText: {
    color: colors.textMuted,
    fontWeight: "700",
    fontSize: 14,
  },
});
