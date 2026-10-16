import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";

import { useAuth } from "../context/AuthContext";
import { logout } from "../services/authService";
import { updateMe } from "../services/usersService";
import {
  openAppSettings,
  requestAndFetchLocation,
} from "../utils/location";
import { HelpNestLogoMark } from "../components/Logo";
import { colors, withAlpha } from "../theme/colors";

const ROLE_LABELS = {
  maid: "Domestic Worker",
  employer: "Employer",
  admin: "Admin",
};

// Placeholder dashboard — the role-specific home (PRD §5) is the next build.
export default function HomeScreen() {
  const navigation = useNavigation();
  const { user, clearSession, updateUser } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  const isEmployer = user?.role !== "maid";
  const firstName = (user?.name || "").split(" ")[0];

  function confirmSignOut() {
    Alert.alert(
      "Sign out",
      "You'll need to log in again to access your HelpNest account.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign out",
          style: "destructive",
          onPress: handleSignOut,
        },
      ]
    );
  }

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);

    try {
      // Revokes every refresh token server-side. Best-effort: the local
      // session is cleared even if the network call fails.
      await logout();
    } catch (error) {
      // Clear locally regardless.
    }

    // Clears the context + SecureStore; RootNavigator remounts the stack
    // and walks the user back through Splash -> RoleSelector.
    clearSession();
    setSigningOut(false);
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar barStyle="light-content" backgroundColor={colors.brand} />

      <View style={styles.header}>
        <View style={styles.brandRow}>
          <View style={styles.logoBadge}>
            <HelpNestLogoMark size={22} />
          </View>
          <Text style={styles.brandText}>HelpNest</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sign out"
          onPress={confirmSignOut}
          disabled={signingOut}
        >
          <Text style={[styles.signOut, signingOut && styles.signOutBusy]}>
            {signingOut ? "Signing out…" : "Sign out"}
          </Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.bodyScroll}
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.karibu}>Karibu{firstName ? `, ${firstName}` : ""} 👋</Text>
        <Text style={styles.roleLine}>
          You're in as a verified-in-progress{" "}
          <Text style={styles.roleBold}>
            {ROLE_LABELS[user?.role] || user?.role || "member"}
          </Text>
          .
        </Text>

        <Pressable
          accessibilityRole="button"
          style={styles.quickAction}
          onPress={() =>
            isEmployer
              ? navigation.navigate("MaidsTab")
              : navigation.navigate("ProfileTab", { screen: "Skills" })
          }
        >
          <View style={styles.quickActionTextWrap}>
            <Text style={styles.quickActionTitle}>
              {isEmployer ? "Find trusted help near you" : "Set up your work profile"}
            </Text>
            <Text style={styles.quickActionText}>
              {isEmployer
                ? "Browse verified domestic workers and unlock contacts safely."
                : "Show employers what you do, your rates and availability."}
            </Text>
          </View>
          <Text style={styles.quickActionArrow}>→</Text>
        </Pressable>

        <LocationPromptCard user={user} updateUser={updateUser} />

        <View style={styles.statusCard}>
          <View style={styles.statusRow}>
            <View style={[styles.dot, user?.phoneVerified ? styles.dotOk : styles.dotIdle]} />
            <Text style={styles.statusText}>
              Phone {user?.phoneVerified ? "verified" : "not verified"}
            </Text>
          </View>
          <View style={styles.statusRow}>
            <View style={[styles.dot, user?.emailVerified ? styles.dotOk : styles.dotIdle]} />
            <Text style={styles.statusText}>
              Email {user?.emailVerified ? "verified" : "verification coming soon"}
            </Text>
          </View>
          <View style={styles.statusRow}>
            <View style={[styles.dot, styles.dotIdle]} />
            <Text style={styles.statusText}>
              KYC: {user?.kycStatus || "unverified"}
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// Nudges the user to share their general location once (lat/lng only).
function LocationPromptCard({ user, updateUser }) {
  const [locating, setLocating] = useState(false);

  const hasCoords =
    user?.locationLat !== null && user?.locationLat !== undefined;

  if (hasCoords) return null;

  async function handleAllow() {
    if (locating) return;
    setLocating(true);

    try {
      const coords = await requestAndFetchLocation();
      await updateMe(coords);
      updateUser(coords);
    } catch (error) {
      if (error?.code === "PERMISSION_DENIED") {
        Alert.alert(
          "Location permission needed",
          error.message,
          [
            { text: "Not now", style: "cancel" },
            ...(error.canAskAgain
              ? []
              : [{ text: "Open settings", onPress: () => openAppSettings() }]),
          ]
        );
      } else {
        Alert.alert(
          "Could not get location",
          error?.message || "Please try again in a moment."
        );
      }
    } finally {
      setLocating(false);
    }
  }

  return (
    <View style={styles.locationCard}>
      <View style={styles.locationTextWrap}>
        <Text style={styles.locationTitle}>Find help near you</Text>
        <Text style={styles.locationText}>
          Allow location access so we can show workers and jobs close to you.
          We store your general area only — never your exact address.
        </Text>
      </View>

      <Pressable
        accessibilityRole="button"
        style={styles.locationButton}
        onPress={handleAllow}
        disabled={locating}
      >
        {locating ? (
          <ActivityIndicator color={colors.white} size="small" />
        ) : (
          <Text style={styles.locationButtonText}>Use my location</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  header: {
    backgroundColor: colors.brand,
    paddingHorizontal: 22,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  logoBadge: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: colors.cream,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  brandText: {
    color: colors.white,
    fontSize: 17,
    fontWeight: "800",
  },
  signOut: {
    color: withAlpha(colors.cream, 0.75),
    fontSize: 13,
    fontWeight: "700",
  },
  signOutBusy: {
    opacity: 0.6,
  },
  bodyScroll: {
    flex: 1,
  },
  body: {
    padding: 22,
    paddingBottom: 32,
  },
  karibu: {
    color: colors.ink,
    fontSize: 26,
    fontWeight: "800",
    marginBottom: 6,
  },
  roleLine: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 24,
  },
  roleBold: {
    color: colors.brand,
    fontWeight: "800",
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.mist,
    padding: 18,
    marginBottom: 14,
  },
  cardTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 6,
  },
  cardText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 20,
  },
  statusCard: {
    backgroundColor: colors.mist,
    borderRadius: 18,
    padding: 18,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 5,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 9,
  },
  dotOk: {
    backgroundColor: colors.brandSoft,
  },
  dotIdle: {
    backgroundColor: colors.gold,
  },
  statusText: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "600",
  },
  quickAction: {
    backgroundColor: colors.brand,
    borderRadius: 18,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  quickActionTextWrap: {
    flex: 1,
    marginRight: 12,
  },
  quickActionTitle: {
    color: colors.white,
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 4,
  },
  quickActionText: {
    color: withAlpha(colors.cream, 0.8),
    fontSize: 12.5,
    lineHeight: 18,
  },
  quickActionArrow: {
    color: colors.white,
    fontSize: 20,
    fontWeight: "800",
  },
  locationCard: {
    backgroundColor: colors.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.mist,
    padding: 16,
    marginBottom: 14,
  },
  locationTextWrap: {
    marginBottom: 12,
  },
  locationTitle: {
    color: colors.ink,
    fontSize: 14.5,
    fontWeight: "800",
    marginBottom: 4,
  },
  locationText: {
    color: colors.textMuted,
    fontSize: 12.5,
    lineHeight: 19,
  },
  locationButton: {
    backgroundColor: colors.brand,
    borderRadius: 12,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  locationButtonText: {
    color: colors.white,
    fontSize: 13.5,
    fontWeight: "800",
  },
});
