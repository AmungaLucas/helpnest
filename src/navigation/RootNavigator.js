import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { useAuth } from "../context/AuthContext";
import SplashScreen from "../screens/SplashScreen";
import RoleSelectorScreen from "../screens/RoleSelectorScreen";
import ConnectionDiagnosticScreen from "../screens/ConnectionDiagnosticScreen";
import SignUpScreen from "../screens/auth/SignUpScreen";
import OtpScreen from "../screens/auth/OtpScreen";
import LoginScreen from "../screens/auth/LoginScreen";
import HomeScreen from "../screens/HomeScreen";
import { colors } from "../theme/colors";

const Stack = createNativeStackNavigator();

export default function RootNavigator() {
  const { user } = useAuth();

  return (
    <Stack.Navigator
      // Logged-in users open straight into Home; everyone else
      // walks the Splash -> RoleSelector -> auth flow.
      //
      // The key remounts the whole stack whenever the auth state flips
      // (login, sign out, silent logout) — `initialRouteName` alone is
      // only read at mount time, so without the key a signed-out user
      // would stay stranded on the Home screen.
      key={user ? "authed" : "guest"}
      initialRouteName={user ? "Home" : "Splash"}
      screenOptions={{
        headerShown: false,
        animation: "fade",
        contentStyle: { backgroundColor: colors.cream },
      }}
    >
      <Stack.Screen name="Splash" component={SplashScreen} />

      <Stack.Screen name="RoleSelector" component={RoleSelectorScreen} />

      <Stack.Screen
        name="SignUp"
        component={SignUpScreen}
        options={{ animation: "slide_from_right" }}
      />

      <Stack.Screen
        name="OtpVerify"
        component={OtpScreen}
        options={{ animation: "slide_from_right" }}
      />

      <Stack.Screen
        name="Login"
        component={LoginScreen}
        options={{ animation: "slide_from_right" }}
      />

      <Stack.Screen
        name="Home"
        component={HomeScreen}
        options={{ gestureEnabled: false }}
      />

      {/* Developer tool — not linked in the user flow. */}
      <Stack.Screen
        name="ConnectionDiagnostic"
        component={ConnectionDiagnosticScreen}
      />
    </Stack.Navigator>
  );
}
