import React, { useEffect, useRef } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthProvider, useAuth } from "./src/context/AuthContext";
import RootNavigator from "./src/navigation/RootNavigator";
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
function Gate() {
  const { initializing } = useAuth();

  if (initializing) {
    return (
      <View style={styles.gate}>
        <ActivityIndicator size="large" color={colors.brand} />
      </View>
    );
  }

  return <RootNavigator />;
}

export default function App() {
  return (
    <AuthProvider>
      <LaunchLocationCapture />
      <SafeAreaProvider>
        <NavigationContainer>
          <Gate />
        </NavigationContainer>
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
