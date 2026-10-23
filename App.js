import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthProvider, useAuth } from "./src/context/AuthContext";
import RootNavigator from "./src/navigation/RootNavigator";
import { loadNavState, saveNavState } from "./src/utils/navState";
import {
  captureLaunchLocation,
  flushPendingLocation,
  stashLocation,
} from "./src/utils/location";
import { colors } from "./src/theme/colors";

// Asks for location permission on first launch (the OS dialog appears once,
// right after install) and quietly logs the device lat/lng on every app
// open. Signed-in users are synced to the backend straight away; guests get
// their coords stashed until applySession fires after signup/login.
function LaunchLocationCapture() {
  const { user, initializing, updateUser } = useAuth();
  const attempted = useRef(false);

  useEffect(() => {
    if (initializing || attempted.current) {
      return;
    }

    attempted.current = true;

    (async () => {
      const coords = await captureLaunchLocation();

      if (!coords) {
        return;
      }

      stashLocation(coords);

      if (user) {
        const freshUser = await flushPendingLocation();

        if (freshUser) {
          updateUser(freshUser);
        }
      }
    })();
  }, [initializing]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

// Waits for the saved session to be restored before the first navigation
// render, so logged-in users open straight into Home without a flash.
//
// Also hosts navigation state persistence: when Android kills the app
// behind a heavy native screen (the ML Kit KYC scanner), the cold start
// restores the user's stack instead of dumping them on Home. The container
// only mounts after the session resolved AND the saved stack loaded,
// because initialState is read exactly once at mount time.
function NavigationHost() {
  const { user, initializing } = useAuth();
  const [navReady, setNavReady] = useState(false);
  const [initialState, setInitialState] = useState(undefined);
  const restoredRef = useRef(false);
  const userKeyRef = useRef(null);

  // Track the account id for save-side tagging (updates on login/logout,
  // while the one-time restore below keeps its mount-time decision).
  useEffect(() => {
    userKeyRef.current = user?.id ?? null;
  }, [user?.id]);

  useEffect(() => {
    if (initializing || restoredRef.current) return;

    restoredRef.current = true;

    // Guests always start at Splash/Login — only a signed-in account gets
    // its own saved stack back, and only if it was saved by the SAME id.
    setInitialState(user ? loadNavState(user.id) : undefined);
    setNavReady(true);
  }, [initializing, user]);

  const handleStateChange = useCallback((state) => {
    if (userKeyRef.current && state) {
      saveNavState(userKeyRef.current, state);
    }
  }, []);

  if (initializing || !navReady) {
    return (
      <View style={styles.gate}>
        <ActivityIndicator size="large" color={colors.brand} />
      </View>
    );
  }

  return (
    <NavigationContainer
      initialState={initialState}
      onStateChange={handleStateChange}
    >
      <RootNavigator />
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <LaunchLocationCapture />
      <SafeAreaProvider>
        <NavigationHost />
      </SafeAreaProvider>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  gate: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.cream,
  },
});
