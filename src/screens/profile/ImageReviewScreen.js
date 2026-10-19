import React, { useState } from "react";
import {
  Image,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import PrimaryButton from "../components/ui/PrimaryButton";
import TabBarIcon from "../components/ui/TabBarIcon";
import { colors, withAlpha } from "../theme/colors";

// Review-before-upload (W2-F3 polish, 2026-10-20).
//
// Every photo the user picks — KYC documents from the gallery, the profile
// picture — lands here BEFORE anything is uploaded. The screen never touches
// the network: on "Use photo" it hands the local file URI back to the caller
// via route.params.onUse(uri) and pops itself; "Choose different" just pops.
// The caller (VerificationScreen / AccountScreen) owns staging + upload.
//
// Camera captures skip this screen — KYCCameraScreen already has its own
// review step (Retake / Use photo) built into the shutter flow.

export default function ImageReviewScreen({ route, navigation }) {
  const uri = route?.params?.uri;
  const title = route?.params?.title || "Review photo";
  const subtitle = route?.params?.subtitle;
  const onUse = route?.params?.onUse;
  const [busy, setBusy] = useState(false);

  if (!uri) {
    // Nothing to review (deep link / stale params) — bail out gracefully.
    navigation.goBack();
    return null;
  }

  function handleUse() {
    if (busy) return;

    setBusy(true);
    onUse?.(uri);
    navigation.goBack();
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <StatusBar barStyle="light-content" backgroundColor="#0B0F0C" />

      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => navigation.goBack()}
          style={styles.roundButton}
          disabled={busy}
        >
          <TabBarIcon name="x" color={colors.white} size={22} />
        </Pressable>
        <Text style={styles.topTitle}>{title}</Text>
        <View style={styles.roundButton} />
      </View>

      <View style={styles.previewWrap}>
        <Image
          source={{ uri }}
          style={styles.preview}
          resizeMode="contain"
          accessible={false}
        />
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>

      <View style={styles.bottomBar}>
        <Text style={styles.hint}>
          Nothing is uploaded yet — this photo stays on your phone until you
          confirm it below.
        </Text>

        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.goBack()}
          style={styles.ghostButton}
          disabled={busy}
        >
          <Text style={styles.ghostText}>Choose different photo</Text>
        </Pressable>

        <PrimaryButton
          label={busy ? "Working…" : "Use this photo"}
          onPress={handleUse}
          loading={busy}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#0B0F0C",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  roundButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: withAlpha("#FFFFFF", 0.12),
    alignItems: "center",
    justifyContent: "center",
  },
  topTitle: {
    color: colors.white,
    fontSize: 15,
    fontWeight: "800",
  },
  previewWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  preview: {
    width: "100%",
    flex: 1,
    borderRadius: 18,
    backgroundColor: "#000000",
  },
  subtitle: {
    color: withAlpha("#FFFFFF", 0.72),
    fontSize: 12.5,
    lineHeight: 18,
    textAlign: "center",
    marginTop: 12,
  },
  bottomBar: {
    paddingHorizontal: 22,
    paddingBottom: 18,
    paddingTop: 12,
  },
  hint: {
    color: withAlpha("#FFFFFF", 0.55),
    fontSize: 12,
    lineHeight: 17,
    textAlign: "center",
    marginBottom: 14,
  },
  ghostButton: {
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 12,
    backgroundColor: withAlpha("#FFFFFF", 0.14),
  },
  ghostText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: "800",
  },
});
