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
import Svg, { Path } from "react-native-svg";

export default function SplashScreen({ navigation }) {
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
    Animated.loop(
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
    ).start();

    // -------- Navigate after the intro finishes --------
    const timer = setTimeout(() => {
      navigation.replace("RoleSelector");
    }, 2600);

    return () => clearTimeout(timer);
  }, [navigation]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#214E3B" />

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
            <Svg viewBox="0 0 100 100" width={66} height={66}>
              {/* Roof */}
              <Path
                d="M 16 50 L 50 20 L 84 50"
                stroke="#214E3B"
                strokeWidth={7}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
              {/* Body / walls */}
              <Path
                d="M 26 50 L 26 84 L 74 84 L 74 50"
                stroke="#214E3B"
                strokeWidth={7}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
              {/* Heart */}
              <Path
                d="M 50 74 C 41 66 34 60 34 53 C 34 47 39 43 44 43 C 47 43 49 45 50 48 C 51 45 53 43 56 43 C 61 43 66 47 66 53 C 66 60 59 66 50 74 Z"
                fill="#D6A64F"
              />
            </Svg>
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
    backgroundColor: "#214E3B",
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
    borderColor: "rgba(214,166,79,0.55)",
  },
  logoBadge: {
    width: 88,
    height: 88,
    borderRadius: 27,
    backgroundColor: "#F7F3E9",
    alignItems: "center",
    justifyContent: "center",
  },

  /* ---- Text ---- */
  brand: {
    color: "#FFFFFF",
    fontSize: 36,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  tagline: {
    color: "#E5EBE5",
    fontSize: 14,
    marginTop: 9,
  },
  footer: {
    position: "absolute",
    bottom: 32,
    color: "#D6A64F",
    fontSize: 12,
    letterSpacing: 0.5,
  },
});