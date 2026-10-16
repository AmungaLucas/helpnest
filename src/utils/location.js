import * as Location from "expo-location";
import { Linking } from "react-native";

// Device location helpers (PRD §6 — approximate area + coords).
// Coarse "Balanced" accuracy is enough: we store lat/lng for proximity
// matching, while users type their own area label for display.

export async function requestAndFetchLocation() {
  const { status, canAskAgain } = await Location.requestForegroundPermissionsAsync();

  if (status !== "granted") {
    const error = new Error(
      canAskAgain
        ? "Location permission was declined. Enable it to find help near you."
        : "Location is blocked for HelpNest. Enable it in Settings to find help near you."
    );
    error.code = "PERMISSION_DENIED";
    error.canAskAgain = Boolean(canAskAgain);
    throw error;
  }

  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });

  return {
    locationLat: Number(position.coords.latitude.toFixed(7)),
    locationLng: Number(position.coords.longitude.toFixed(7)),
  };
}

export function openAppSettings() {
  return Linking.openSettings();
}
