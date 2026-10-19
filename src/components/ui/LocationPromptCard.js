import React, { useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { useAuth } from "../../context/AuthContext";
import { updateMe } from "../../services/usersService";
import {
  openAppSettings,
  requestAndFetchLocation,
} from "../../utils/location";
import { colors } from "../../theme/colors";

// Nudges the user to share their general location once (lat/lng only).
// Renders nothing once coords exist. Used by both role home screens.
export default function LocationPromptCard() {
  const { user, updateUser } = useAuth();
  const [locating, setLocating] = useState(false);

  const hasCoords =
    user?.locationLat !== null && user?.locationLat !== undefined;

  if (hasCoords) return null;

  async function handleAllow() {
    if (locating) return;
    setLocating(true);

    try {
      const coords = await requestAndFetchLocation();

      // A label the user typed themselves always wins — only auto-fill
      // when there is nothing to preserve.
      const payload = user?.locationLabel ? { ...coords } : coords;
      delete payload.locationLabel;
      if (!user?.locationLabel && coords.locationLabel) {
        payload.locationLabel = coords.locationLabel;
      }

      await updateMe(payload);
      updateUser(payload);
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
    <View style={styles.card}>
      <View style={styles.textWrap}>
        <Text style={styles.title}>
          {user?.role === "maid" ? "Find work near you" : "Find help near you"}
        </Text>
        <Text style={styles.body}>
          Allow location access so we can show{" "}
          {user?.role === "maid" ? "jobs" : "workers and jobs"} close to you.
          We store your general area only — never your exact address.
        </Text>
      </View>

      <Pressable
        accessibilityRole="button"
        style={styles.button}
        onPress={handleAllow}
        disabled={locating}
      >
        {locating ? (
          <ActivityIndicator color={colors.white} size="small" />
        ) : (
          <Text style={styles.buttonText}>Use my location</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.mist,
    padding: 16,
    marginBottom: 14,
  },
  textWrap: {
    marginBottom: 12,
  },
  title: {
    color: colors.ink,
    fontSize: 14.5,
    fontWeight: "800",
    marginBottom: 4,
  },
  body: {
    color: colors.textMuted,
    fontSize: 12.5,
    lineHeight: 19,
  },
  button: {
    backgroundColor: colors.brand,
    borderRadius: 12,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    color: colors.white,
    fontSize: 13.5,
    fontWeight: "800",
  },
});
