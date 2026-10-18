import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  Animated,
  Easing,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { HelpNestLogoMark } from "../components/Logo";
import { useAuth } from "../context/AuthContext";
import { colors, withAlpha } from "../theme/colors";

export default function SplashScreen({ navigation }) {
  const { hasAccount } = useAuth();
  // entry animations
  const logoScale = useRef(new Animated.Value(0.6)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;

  const haloScale = useRef(new Animated.Value(0.6)).current;
  const haloOpacity = useRef(new Animated.Value(0)).current;

  const brandOpacity = useRef(new Animated.Value(0)).current;
  const brandY = useRef(new Animated.Value(14)).current;

  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const taglineY = useRef(new Animated.Value(10)).current;

  const footerOpacity = useRef(new Animated.Value(0)).current;

  // idle breathing
  const breathe = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // -------- Entry sequence --------
    Animated.sequence([
      // Stage 1: logo springs in + halo ring expands and fades
      Animated.parallel([
        Animated.spring(logoScale, {
          toValue: 1,
          friction: 6,
          tension: 70,
          useNativeDriver: true,
        }),
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 450,
          useNativeDriver: true,
        }),
        Animated.timing(haloScale, {
          toValue: 1.9,
          duration: 1100,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(haloOpacity, {
            toValue: 1,
            duration: 250,
            useNativeDriver: true,
          }),
          Animated.timing(haloOpacity, {
            toValue: 0,
            duration: 850,
            useNativeDriver: true,
          }),
        ]),
      ]),

      // Stage 2: brand name rises in
      Animated.parallel([
        Animated.timing(brandOpacity, {
          toValue: 1,
          duration: 320,
          useNativeDriver: true,
        }),
        Animated.timing(brandY, {
          toValue: 0,
          duration: 380,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),

      // Stage 3: tagline rises in
      Animated.parallel([
        Animated.timing(taglineOpacity, {
          toValue: 1,
          duration: 320,
          useNativeDriver: true,
        }),
        Animated.timing(taglineY, {
          toValue: 0,
          duration: 380,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),

      // Stage 4: footer fades in
      Animated.timing(footerOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();

    // -------- Idle: gentle breathing on the logo --------
    // Keep a reference so the loop can be stopped on unmount; otherwise it
    // keeps running on the native driver forever after navigation.replace().
    const breatheLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, {
          toValue: 1.04,
          duration: 1400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(breathe, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    breatheLoop.start();

    // -------- Navigate after the intro finishes --------
    // Fresh device -> role selection. A device that onboarded before but
    // has no live session (GuestStack normally skips this screen entirely
    // in that case) -> Login.
    const timer = setTimeout(() => {
      navigation.replace(hasAccount ? "Login" : "RoleSelector");
    }, 2600);

    return () => {
      clearTimeout(timer);
      breatheLoop.stop();
    };
  }, [navigation, hasAccount]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.brand} />

      <View style={styles.content}>
        {/* ---- Logo stage ---- */}
        <View style={styles.logoStage}>
          {/* Expanding halo ring */}
          <Animated.View
            style={[
              styles.halo,
              {
                opacity: haloOpacity,
                transform: [{ scale: haloScale }],
              },
            ]}
          />

          {/* Cream badge with house + heart */}
          <Animated.View
            style={[
              styles.logoBadge,
              {
                opacity: logoOpacity,
                transform: [
                  { scale: Animated.multiply(logoScale, breathe) },
                ],
              },
            ]}
          >
            <HelpNestLogoMark size={66} />
          </Animated.View>
        </View>

        {/* ---- Brand name ---- */}
        <Animated.Text
          style={[
            styles.brand,
            {
              opacity: brandOpacity,
              transform: [{ translateY: brandY }],
            },
          ]}
        >
          HelpNest
        </Animated.Text>

        {/* ---- Tagline ---- */}
        <Animated.Text
          style={[
            styles.tagline,
            {
              opacity: taglineOpacity,
              transform: [{ translateY: taglineY }],
            },
          ]}
        >
          Trusted people. Happier homes.
        </Animated.Text>
      </View>

      {/* ---- Footer ---- */}
      <Animated.Text style={[styles.footer, { opacity: footerOpacity }]}>
        A better way to connect.
      </Animated.Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    alignItems: "center",
  },

  /* ---- Logo stage ---- */
  logoStage: {
    width: 88,
    height: 88,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 22,
  },
  halo: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 44,
    borderWidth: 2,
    borderColor: withAlpha(colors.gold, 0.55),
  },
  logoBadge: {
    width: 88,
    height: 88,
    borderRadius: 27,
    backgroundColor: colors.cream,
    alignItems: "center",
    justifyContent: "center",
  },

  /* ---- Text ---- */
  brand: {
    color: colors.white,
    fontSize: 36,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  tagline: {
    color: colors.mist,
    fontSize: 14,
    marginTop: 9,
  },
  footer: {
    position: "absolute",
    bottom: 32,
    color: colors.gold,
    fontSize: 12,
    letterSpacing: 0.5,
  },
});