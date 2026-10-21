// Connection diagnostic — original test screen kept as a developer tool.
// Reachable via the "ConnectionDiagnostic" route; not linked in the user flow.

import React, { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";

import ScreenHeader from "../components/ui/ScreenHeader";
import { testApiHealth } from "../config/api";
import { colors, withAlpha } from "../theme/colors";

export default function ConnectionDiagnosticScreen() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  async function handleTestConnection() {
    setLoading(true);
    setResult(null);
    setError("");

    try {
      const data = await testApiHealth();
      setResult(data);
    } catch (err) {
      setError(
        err?.message ||
          "Could not connect. Check your internet connection and API deployment."
      );
    } finally {
      setLoading(false);
    }
  }

  const connected = Boolean(result?.success && result?.database === "connected");

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.cream} />

      <ScreenHeader
        leading="none"
        title="HelpNest"
        subtitle="Trusted people. Happier homes."
      />

      <ScrollView
        contentContainerStyle={styles.page}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>CONNECTION SETUP</Text>
          <Text style={styles.title}>Let's connect HelpNest</Text>
          <Text style={styles.description}>
            This screen checks whether the mobile app can reach your hosted
            Node.js API and whether that API can connect to MySQL.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Backend status</Text>
          <Text style={styles.apiUrl}>https://gateway.jobready.co.ke</Text>

          <View style={styles.statusRow}>
            <View
              style={[
                styles.statusDot,
                connected
                  ? styles.statusDotSuccess
                  : error
                    ? styles.statusDotError
                    : styles.statusDotIdle,
              ]}
            />
            <Text style={styles.statusLabel}>
              {loading
                ? "Checking connection…"
                : connected
                  ? "API and database connected"
                  : error
                    ? "Connection failed"
                    : "Not tested yet"}
            </Text>
          </View>

          {loading ? (
            <View style={styles.loading}>
              <ActivityIndicator size="small" color={colors.brand} />
              <Text style={styles.helperText}>Contacting your server…</Text>
            </View>
          ) : null}

          {connected ? (
            <View style={styles.successBox}>
              <Text style={styles.resultTitle}>Connection successful</Text>
              <Text style={styles.resultText}>
                {result.message || "HelpNest API is running."}
              </Text>
              <Text style={styles.resultText}>Database: {result.database}</Text>
            </View>
          ) : null}

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorTitle}>Unable to connect</Text>
              <Text style={styles.errorText}>{error}</Text>
              <Text style={styles.helperText}>
                Confirm that the API is deployed, HTTPS is active, and the
                /api/health endpoint works in your phone's browser.
              </Text>
            </View>
          ) : null}

          <Pressable
            accessibilityRole="button"
            onPress={handleTestConnection}
            disabled={loading}
            android_ripple={{ color: withAlpha(colors.brand, 0.08) }}
            style={({ pressed }) => [
              styles.button,
              pressed && !loading ? styles.buttonPressed : null,
              loading ? styles.buttonDisabled : null,
            ]}
          >
            {loading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.buttonText}>
                {connected ? "Test again" : "Test API connection"}
              </Text>
            )}
          </Pressable>

          <Text style={styles.note}>
            Security note: the app connects to the API over HTTPS. Database
            credentials stay on your backend and are never stored in this app.
          </Text>
        </View>

        <Text style={styles.footer}>HelpNest · Connection diagnostic</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  page: {
    flexGrow: 1,
    padding: 20,
    paddingTop: 20,
    paddingBottom: 36,
  },
  hero: {
    marginBottom: 24,
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
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "800",
    letterSpacing: -0.6,
    marginBottom: 10,
  },
  description: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.mist,
    padding: 20,
    shadowColor: colors.ink,
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 1,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 17.5,
    fontWeight: "800",
    letterSpacing: -0.2,
    marginBottom: 7,
  },
  apiUrl: {
    color: colors.brand,
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 19,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  statusDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    marginRight: 9,
  },
  statusDotSuccess: {
    backgroundColor: colors.brandSoft,
  },
  statusDotError: {
    backgroundColor: colors.danger,
  },
  statusDotIdle: {
    backgroundColor: colors.gold,
  },
  statusLabel: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "600",
  },
  loading: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  helperText: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    marginLeft: 8,
    flexShrink: 1,
  },
  successBox: {
    backgroundColor: withAlpha(colors.brandSoft, 0.16),
    borderRadius: 12,
    padding: 13,
    marginBottom: 16,
  },
  resultTitle: {
    color: colors.brand,
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 5,
  },
  resultText: {
    color: colors.ink,
    fontSize: 13,
    lineHeight: 20,
  },
  errorBox: {
    backgroundColor: withAlpha(colors.danger, 0.08),
    borderRadius: 12,
    padding: 13,
    marginBottom: 16,
  },
  errorTitle: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 5,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 7,
  },
  button: {
    minHeight: 54,
    borderRadius: 14,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    marginTop: 4,
    overflow: "hidden",
  },
  buttonPressed: {
    opacity: 0.88,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: "800",
  },
  note: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 17,
  },
  footer: {
    textAlign: "center",
    color: colors.textFaint,
    fontSize: 12,
    marginTop: 24,
  },
});
