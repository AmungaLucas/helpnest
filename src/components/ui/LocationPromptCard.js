import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useAuth } from "../../context/AuthContext";
import { updateMe } from "../../services/usersService";
import {
  openAppSettings,
  requestAndFetchLocation,
} from "../../utils/location";
import TabBarIcon from "./TabBarIcon";
import { colors, withAlpha } from "../../theme/colors";

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
      <View style={styles.row}>
        <View style={styles.icon}>
          <TabBarIcon name="map-pin" color={colors.brand} size={18} />
        </View>
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
      </View>

      <Pressable
        accessibilityRole="button"
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        onPress={handleAllow}
        disabled={locating}
        android_ripple={{ color: withAlpha(colors.white, 0.18) }}
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
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.mist,
    padding: 16,
    marginBottom: 14,
    shadowColor: colors.ink,
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 1,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 14,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: withAlpha(colors.brand, 0.1),
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  textWrap: {
    flex: 1,
  },
  title: {
    color: colors.ink,
    fontSize: 15.5,
    fontWeight: "800",
    letterSpacing: -0.2,
    marginBottom: 4,
  },
  body: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  button: {
    backgroundColor: colors.brand,
    borderRadius: 14,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  pressed: {
    opacity: 0.88,
  },
  buttonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: "800",
  },
});
