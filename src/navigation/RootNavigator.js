import React, { useEffect } from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { useAuth } from "../context/AuthContext";
import SplashScreen from "../screens/SplashScreen";
import RoleSelectorScreen from "../screens/RoleSelectorScreen";
import ConnectionDiagnosticScreen from "../screens/ConnectionDiagnosticScreen";
import SignUpScreen from "../screens/auth/SignUpScreen";
import OtpScreen from "../screens/auth/OtpScreen";
import LoginScreen from "../screens/auth/LoginScreen";
import MainTabs from "./MainTabs";
import WorkerProfileScreen from "../screens/tabs/WorkerProfileScreen";
import MpesaCheckoutScreen from "../screens/tabs/MpesaCheckoutScreen";
import { colors } from "../theme/colors";

const Stack = createNativeStackNavigator();

const screenOptions = {
  headerShown: false,
  animation: "fade",
  contentStyle: { backgroundColor: colors.cream },
};

// Signed-out area: splash, role selection and auth screens. Rendered only
// while there is no session, so every screen here can assume `user` is null.
function GuestStack() {
  return (
    <Stack.Navigator initialRouteName="Splash" screenOptions={screenOptions}>
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

      {/* Developer tool — not linked in the user flow. */}
      <Stack.Screen name="ConnectionDiagnostic" component={ConnectionDiagnosticScreen} />
    </Stack.Navigator>
  );
}

// Signed-in area: role-specific tabs plus stack-only detail screens.
// Rendered only while a session exists.
function AuthedStack() {
  return (
    <Stack.Navigator initialRouteName="Main" screenOptions={screenOptions}>
      <Stack.Screen
        name="Main"
        component={MainTabs}
        options={{ gestureEnabled: false }}
      />

      <Stack.Screen
        name="WorkerProfile"
        component={WorkerProfileScreen}
        options={{ animation: "slide_from_right" }}
      />

      <Stack.Screen
        name="MpesaCheckout"
        component={MpesaCheckoutScreen}
        options={{ animation: "slide_from_right" }}
      />

      {/* Developer tool — not linked in the user flow. */}
      <Stack.Screen name="ConnectionDiagnostic" component={ConnectionDiagnosticScreen} />
    </Stack.Navigator>
  );
}

export default function RootNavigator() {
  const { user } = useAuth();

  // Canonical React Navigation auth pattern: swap between two SEPARATE
  // navigators when the session state flips, instead of remounting a single
  // navigator via `key`. On login (applySession) the guest stack — including
  // whatever OTP/sign-up screen is open — unmounts and the authed stack
  // mounts straight at Main. On sign-out (clearSession) the authed stack
  // unmounts and the guest stack mounts at Splash, which auto-advances to
  // RoleSelector.
  //
  // The earlier single-navigator + key-remount approach did not swap
  // reliably on device (login and sign-out both left the user stranded),
  // and the interim "reset from the screen" workaround dispatched actions
  // on the wrong navigator (tab/drawer-level resets to a root-only route).
  // With this swap neither is needed: navigation is driven purely by the
  // `user` value from AuthContext.
  useEffect(() => {
    console.log("[NAV] auth area ->", user ? "authed" : "guest");
  }, [user]);

  return user ? <AuthedStack /> : <GuestStack />;
}
