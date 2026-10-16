import * as Location from "expo-location";
import { Linking } from "react-native";

import { updateMe } from "../services/usersService";

// Device location helpers (PRD §6 — approximate area + coords).
// Coarse "Balanced" accuracy is enough: we store lat/lng for proximity
// matching, while users type their own area label for display.

// ---------------------------------------------------------------------------
// Launch capture
//
// On every app open we ask for permission (first run only — the OS dialog
// appears once) and grab a coarse fix. If the user is not signed in yet,
// the coords are stashed here and flushed to the backend as soon as a
// session exists (AuthContext.applySession), so first-run users keep their
// location by the time they land on Home. Everything is best-effort: any
// failure is silent and never blocks the launch flow.
// ---------------------------------------------------------------------------

let pendingLocation = null;
let flushInFlight = false;

// Returns { locationLat, locationLng } or null. Asks for permission only
// when it has never been determined; a plain "denied" stays silent here —
// the Home card is the place where we explain and re-ask.
export async function captureLaunchLocation() {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();

    if (status !== "granted") {
      if (status !== "undetermined") {
        return null;
      }

      const request = await Location.requestForegroundPermissionsAsync();

      if (request.status !== "granted") {
        return null;
      }
    }

    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    return {
      locationLat: Number(position.coords.latitude.toFixed(7)),
      locationLng: Number(position.coords.longitude.toFixed(7)),
    };
  } catch (error) {
    if (__DEV__) {
      console.log("[LOCATION] launch capture failed:", error?.message || error);
    }

    // Location services off, GPS timeout, etc.
    return null;
  }
}

export function stashLocation(coords) {
  pendingLocation = coords;
}

// PATCHes the stashed coords to /api/users/me. Returns the fresh user
// object on success (callers merge it into the session), or null on any
// failure — the coords stay stashed for the next attempt.
export async function flushPendingLocation() {
  if (!pendingLocation || flushInFlight) {
    return null;
  }

  flushInFlight = true;

  try {
    const result = await updateMe(pendingLocation);
    pendingLocation = null;
    return result?.user || null;
  } catch (error) {
    if (__DEV__) {
      console.log(
        "[LOCATION] sync failed (will retry on next session/launch):",
        error?.message || error
      );
    }

    // Offline, 404 on a stale deployment, whatever — retry later.
    return null;
  } finally {
    flushInFlight = false;
  }
}

// ---------------------------------------------------------------------------
// Manual capture (Home "Use my location" card)
// ---------------------------------------------------------------------------

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
