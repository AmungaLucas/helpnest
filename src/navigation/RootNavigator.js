import React, { useEffect } from "react";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
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
import PostJobScreen from "../screens/tabs/PostJobScreen";
import ChatRoomScreen from "../screens/chats/ChatRoomScreen";
import KYCCameraScreen from "../screens/profile/KYCCameraScreen";
import ImageReviewScreen from "../screens/profile/ImageReviewScreen";
import { HelpNestLogoMark } from "../components/Logo";
import { colors } from "../theme/colors";

const Stack = createNativeStackNavigator();

const screenOptions = {
  headerShown: false,
  animation: "fade",
  contentStyle: { backgroundColor: colors.cream },
};

// Signed-out area: splash, role selection and auth screens. Rendered only
// while there is no session, so every screen here can assume `user` is null.
//
// Entry route (PRD §5 onboarding flow):
//   - device never onboarded  -> Splash (then RoleSelector)
//   - device onboarded before -> Login directly (sign-out / expired session)
function GuestStack({ entry }) {
  return (
    <Stack.Navigator initialRouteName={entry} screenOptions={screenOptions}>
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
        name="PostJob"
        component={PostJobScreen}
        options={{ animation: "slide_from_right" }}
      />

      <Stack.Screen
        name="ChatRoom"
        component={ChatRoomScreen}
        options={{ animation: "slide_from_right" }}
      />

      <Stack.Screen
        name="MpesaCheckout"
        component={MpesaCheckoutScreen}
        options={{ animation: "slide_from_right" }}
      />

      {/* Full-screen guided capture for KYC documents (ID rect / selfie oval).
          Registered at the root so it covers the drawer + tab chrome. */}
      <Stack.Screen
        name="KYCCamera"
        component={KYCCameraScreen}
        options={{ animation: "slide_from_right", orientation: "portrait" }}
      />

      {/* Review-before-upload for every gallery pick (KYC docs + profile
          photo). Root-level like KYCCamera so it covers the chrome. */}
      <Stack.Screen
        name="ImageReview"
        component={ImageReviewScreen}
        options={{ animation: "slide_from_right", orientation: "portrait" }}
      />

      {/* Developer tool — not linked in the user flow. */}
      <Stack.Screen name="ConnectionDiagnostic" component={ConnectionDiagnosticScreen} />
    </Stack.Navigator>
  );
}

// Static branded splash shown while AuthContext restores the session
// (refresh-token rotation can take seconds on a slow network). Keeping this
// OUTSIDE the navigator means the animated SplashScreen only ever mounts
// after restore finished, so its "advance after 2.6s" timer can never race
// the restore and flash RoleSelector under a logged-in user.
function BootSplash() {
  return (
    <SafeAreaView style={bootStyles.container}>
      <View style={bootStyles.badge}>
        <HelpNestLogoMark size={56} />
      </View>
      <Text style={bootStyles.brand}>HelpNest</Text>
    </SafeAreaView>
  );
}

const bootStyles = {
  container: {
    flex: 1,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    width: 84,
    height: 84,
    borderRadius: 26,
    backgroundColor: colors.cream,
    alignItems: "center",
    justifyContent: "center",
  },
  brand: {
    color: colors.white,
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: 0.5,
    marginTop: 18,
  },
};

export default function RootNavigator() {
  const { user, initializing, hasAccount } = useAuth();

  // Canonical React Navigation auth pattern: swap between two SEPARATE
  // navigators when the session state flips, instead of remounting a single
  // navigator via `key`. On login (applySession) the guest stack — including
  // whatever OTP/sign-up screen is open — unmounts and the authed stack
  // mounts straight at Main. On sign-out (clearSession) the authed stack
  // unmounts and the guest stack mounts directly at Login (the device has
  // an account, so role selection is not replayed).
  //
  // The earlier single-navigator + key-remount approach did not swap
  // reliably on device (login and sign-out both left the user stranded),
  // and the interim "reset from the screen" workaround dispatched actions
  // on the wrong navigator (tab/drawer-level resets to a root-only route).
  // With this swap neither is needed: navigation is driven purely by the
  // `user` value from AuthContext.
  //
  // GuestStack is keyed on the entry route so a change of entry (e.g. the
  // hasAccount flag resolving during boot) remounts the navigator cleanly.
  useEffect(() => {
    console.log("[NAV] auth area ->", user ? "authed" : "guest");
  }, [user]);

  if (initializing) {
    return <BootSplash />;
  }

  if (user) {
    return <AuthedStack />;
  }

  return <GuestStack key={hasAccount ? "returning" : "fresh"} entry={hasAccount ? "Login" : "Splash"} />;
}
