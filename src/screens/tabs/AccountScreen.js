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

import { useAuth } from "../../context/AuthContext";
import { logout } from "../../services/authService";
import { updateMe } from "../../services/usersService";
import {
  openAppSettings,
  requestAndFetchLocation,
} from "../../utils/location";
import { colors, withAlpha } from "../../theme/colors";

const ROLE_LABELS = {
  maid: "Domestic Worker",
  employer: "Employer",
  admin: "Admin",
};

export default function AccountScreen() {
  const navigation = useNavigation();
  const { user, clearSession, updateUser } = useAuth();
  const [locating, setLocating] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const firstName = (user?.name || "").split(" ")[0] || "?";
  const hasCoords = user?.locationLat !== null && user?.locationLat !== undefined;

  function confirmSignOut() {
    Alert.alert(
      "Sign out",
      "You'll need to log in again to access your HelpNest account.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Sign out", style: "destructive", onPress: handleSignOut },
      ]
    );
  }

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);

    try {
      await logout();
    } catch (error) {
      // Clear locally regardless.
    }

    clearSession();
    setSigningOut(false);
  }

  async function handleUseLocation() {
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
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.cream} />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.profileRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{firstName.charAt(0)}</Text>
          </View>
          <View style={styles.profileMain}>
            <Text style={styles.name}>{user?.name}</Text>
            <Text style={styles.roleLine}>
              {ROLE_LABELS[user?.role] || user?.role || "Member"} ·{" "}
              {user?.phone}
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Verification</Text>

          <StatusRow
            ok={user?.phoneVerified}
            okText="Phone verified"
            pendingText="Phone not verified yet"
          />
          <StatusRow
            ok={user?.emailVerified}
            okText="Email verified"
            pendingText="Email verification coming soon"
          />
          <StatusRow
            ok={user?.kycStatus === "verified"}
            okText="ID verification complete"
            pendingText={`KYC: ${user?.kycStatus || "unverified"}`}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Location</Text>

          {hasCoords ? (
            <>
              <Text style={styles.locationLine}>
                {user?.locationLabel
                  ? `${user.locationLabel} · `
                  : ""}
                {Number(user.locationLat).toFixed(4)},{" "}
                {Number(user.locationLng).toFixed(4)}
              </Text>
              <Text style={styles.locationNote}>
                Used to show you nearby workers and jobs — never your exact
                address.
              </Text>
            </>
          ) : (
            <Text style={styles.locationNote}>
              Add your general location so we can match you with work and
              workers nearby. Your exact address is never shared.
            </Text>
          )}

          <Pressable
            accessibilityRole="button"
            style={styles.secondaryButton}
            onPress={handleUseLocation}
            disabled={locating}
          >
            {locating ? (
              <ActivityIndicator color={colors.brand} />
            ) : (
              <Text style={styles.secondaryButtonText}>
                {hasCoords ? "Update my location" : "Use my current location"}
              </Text>
            )}
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Payments</Text>
          <Text style={styles.locationNote}>
            M-Pesa is wired up. Try a KES 1 test payment to confirm STK push
            works on your phone before real pricing goes live.
          </Text>
          <Pressable
            accessibilityRole="button"
            style={styles.secondaryButton}
            onPress={() =>
              navigation.navigate("MpesaCheckout", {
                plan: "test_kes1",
                label: "M-Pesa test payment",
              })
            }
          >
            <Text style={styles.secondaryButtonText}>Try a KES 1 test payment</Text>
          </Pressable>
        </View>

        <Pressable
          accessibilityRole="button"
          style={styles.signOutButton}
          onPress={confirmSignOut}
          disabled={signingOut}
        >
          <Text style={styles.signOutText}>
            {signingOut ? "Signing out…" : "Sign out"}
          </Text>
        </Pressable>

        <Text style={styles.versionText}>HelpNest v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatusRow({ ok, okText, pendingText }) {
  return (
    <View style={styles.statusRow}>
      <View style={[styles.dot, ok ? styles.dotOk : styles.dotIdle]} />
      <Text style={styles.statusText}>{ok ? okText : pendingText}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  scroll: {
    padding: 22,
    paddingBottom: 60,
  },
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 19,
    backgroundColor: withAlpha(colors.brand, 0.14),
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  avatarText: {
    color: colors.brand,
    fontSize: 24,
    fontWeight: "800",
  },
  profileMain: {
    flex: 1,
  },
  name: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: "800",
  },
  roleLine: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "600",
    marginTop: 2,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.mist,
    padding: 16,
    marginBottom: 14,
  },
  cardTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 10,
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
  locationLine: {
    color: colors.ink,
    fontSize: 13.5,
    fontWeight: "700",
    marginBottom: 6,
  },
  locationNote: {
    color: colors.textMuted,
    fontSize: 12.5,
    lineHeight: 19,
    marginBottom: 12,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: colors.brand,
    borderRadius: 12,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  secondaryButtonText: {
    color: colors.brand,
    fontSize: 13.5,
    fontWeight: "800",
  },
  signOutButton: {
    borderWidth: 1,
    borderColor: "#C24136",
    borderRadius: 14,
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
  },
  signOutText: {
    color: "#C24136",
    fontSize: 14.5,
    fontWeight: "800",
  },
  versionText: {
    color: colors.textFaint,
    fontSize: 11.5,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 18,
  },
});
