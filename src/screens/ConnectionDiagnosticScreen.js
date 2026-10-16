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

import { testApiHealth } from "../config/api";
import { colors } from "../theme/colors";

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

      <ScrollView
        contentContainerStyle={styles.page}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.brandRow}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>H</Text>
          </View>
          <View>
            <Text style={styles.brand}>HelpNest</Text>
            <Text style={styles.tagline}>Trusted people. Happier homes.</Text>
          </View>
        </View>

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
    padding: 22,
    paddingTop: 30,
    paddingBottom: 36,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 38,
  },
  logo: {
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  logoText: {
    color: colors.white,
    fontSize: 27,
    fontWeight: "800",
  },
  brand: {
    color: colors.brand,
    fontSize: 23,
    fontWeight: "800",
  },
  tagline: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  hero: {
    marginBottom: 24,
  },
  eyebrow: {
    color: colors.goldDark,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  title: {
    color: colors.ink,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "800",
    marginBottom: 10,
  },
  description: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 23,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.mist,
    padding: 20,
    shadowColor: colors.ink,
    shadowOpacity: 0.05,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 7,
  },
  apiUrl: {
    color: colors.brand,
    fontSize: 13,
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
    backgroundColor: "#2E8B57",
  },
  statusDotError: {
    backgroundColor: "#C24136",
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
    backgroundColor: "#EAF4EC",
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
    backgroundColor: "#FFF0EE",
    borderRadius: 12,
    padding: 13,
    marginBottom: 16,
  },
  errorTitle: {
    color: "#A52F25",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 5,
  },
  errorText: {
    color: "#7D2922",
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 7,
  },
  button: {
    minHeight: 50,
    borderRadius: 12,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    marginTop: 4,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: "700",
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
