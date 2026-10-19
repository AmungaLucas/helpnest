import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

import PrimaryButton from "../../components/ui/PrimaryButton";
import TabBarIcon from "../../components/ui/TabBarIcon";
import { colors, withAlpha } from "../../theme/colors";

// Guided document capture (PRD §4.2 — W2-F3 follow-up).
//
// The system camera (launchCameraAsync) can't draw overlays, so ID/selfie
// capture uses an in-app CameraView with a guide frame:
//
//   id_front / id_back -> rectangle in ID-1 aspect (85.6 x 54 mm) with
//                         corner brackets — "fit the card inside the frame"
//   selfie             -> oval head-and-shoulders guide on the front camera —
//                         "head, shoulders and upper chest inside the oval"
//
// The screen NEVER uploads and holds no server state: on "Use photo" it hands
// the local file URI back to the caller via route.params.onCaptured(uri) and
// pops itself. VerificationScreen owns staging + upload, exactly as if the
// photo had come from the gallery.
//
// Captures are downscaled to <=1600px JPEG q0.8 on-device before handing off —
// the gateway ceiling is 8 MB per upload and modern phone sensors produce
// 12-48 MP frames that blow past it (gallery picks are already compressed by
// the OS picker; camera shots are not).

const GUIDE = {
  // ID-1 cards (Kenyan national ID) are 85.6 x 53.98 mm.
  id: { aspect: 85.6 / 54.0 },
  selfie: { ovalAspect: 0.74 }, // oval width as a fraction of screen width
};

const HINTS = {
  id_front:
    "Place the ID flat and fit it inside the frame — all four corners visible, no glare.",
  id_back:
    "Flip the ID over and fit it inside the frame — the serial number must be readable.",
  selfie:
    "Center your face in the oval — head, shoulders and upper chest, plain background.",
};

export default function KYCCameraScreen({ route, navigation }) {
  const docKind = route?.params?.docKind || "id_front";
  const onCaptured = route?.params?.onCaptured;
  const isSelfie = docKind === "selfie";

  const cameraRef = useRef(null);
  const [permission, requestPermission] = useCameraPermissions();

  const [facing, setFacing] = useState(isSelfie ? "front" : "back");
  const [torchOn, setTorchOn] = useState(false);
  const [shot, setShot] = useState(null); // { uri, width, height } awaiting confirm
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const { width: screenW, height: screenH } = useWindowDimensions();

  // --- guide geometry ------------------------------------------------------
  const isId = !isSelfie;
  const frameW = isId
    ? Math.min(screenW * 0.84, 420)
    : screenW * GUIDE.selfie.ovalAspect;
  const frameH = isId
    ? frameW / GUIDE.id.aspect
    : frameW * 1.38; // tall oval -> head + shoulders + chest
  const frameLeft = (screenW - frameW) / 2;
  const frameTop = isId
    ? (screenH - frameH) / 2 - screenH * 0.05
    : screenH * 0.22;

  async function takeShot() {
    if (busy || !cameraRef.current) return;

    setBusy(true);
    setError("");

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.9,
        exif: false,
      });

      if (!photo?.uri) throw new Error("empty capture");

      setShot({ uri: photo.uri, width: photo.width, height: photo.height });
    } catch (err) {
      setError("Could not take the photo. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmShot() {
    if (!shot || busy) return;

    setBusy(true);
    setError("");

    try {
      // Downscale the long edge to <=1600 px, re-encode JPEG q0.8. The new
      // context API (SDK 52+) replaces the deprecated manipulateAsync.
      const long = Math.max(shot.width || 0, shot.height || 0);
      let context = ImageManipulator.manipulate(shot.uri);

      if (long > 1600) {
        context = context.resize(
          long === shot.width ? { width: 1600 } : { height: 1600 }
        );
      }

      const rendered = await context.renderAsync();
      const saved = await rendered.saveAsync({
        compress: 0.8,
        format: SaveFormat.JPEG,
      });

      try {
        rendered.release();
      } catch (releaseErr) {
        // SharedRef may already be reclaimed — never fatal.
      }

      if (!saved?.uri) throw new Error("save failed");

      onCaptured?.(saved.uri);
      navigation.goBack();
    } catch (err) {
      setError("Could not process the photo. Retake it or use the gallery.");
      setBusy(false);
    }
  }

  function flipCamera() {
    setFacing((prev) => (prev === "back" ? "front" : "back"));
    setTorchOn(false); // front cameras have no torch
  }

  // --- permission gate -----------------------------------------------------
  if (!permission) {
    return (
      <SafeAreaView style={[styles.safeArea, styles.center]}>
        <StatusBar barStyle="light-content" backgroundColor="#0B0F0C" />
        <ActivityIndicator size="large" color={colors.white} />
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={[styles.safeArea, styles.centerPad]}>
        <StatusBar barStyle="light-content" backgroundColor="#0B0F0C" />
        <View style={styles.permCard}>
          <TabBarIcon name="camera" color={colors.white} size={30} />
          <Text style={styles.permTitle}>Camera access needed</Text>
          <Text style={styles.permBody}>
            HelpNest uses the camera to photograph your ID and a selfie for
            verification. Photos never leave your phone until you choose to
            submit them.
          </Text>
          <PrimaryButton
            label="Allow camera access"
            onPress={() => requestPermission()}
          />
          {!permission.canAskAgain ? (
            <Pressable
              accessibilityRole="button"
              style={styles.settingsLink}
              onPress={() => Linking.openSettings()}
            >
              <Text style={styles.settingsLinkText}>
                Blocked? Open Settings to enable the camera
              </Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            style={styles.backLink}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backLinkText}>Not now</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // --- capture view --------------------------------------------------------
  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <StatusBar barStyle="light-content" backgroundColor="#0B0F0C" />

      <View style={styles.cameraShell}>
        {shot && !busy ? (
          <Image
            source={{ uri: shot.uri }}
            style={StyleSheet.absoluteFill}
            resizeMode="contain"
          />
        ) : (
          <CameraView
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            facing={facing}
            mode="picture"
            enableTorch={torchOn && !isSelfie}
          />
        )}

        {/* guide frame — hidden once a shot is being confirmed */}
        {!shot && !busy ? (
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            {/* dim mask around the guide */}
            <View
              style={[styles.maskPanel, { left: 0, right: 0, top: 0, height: frameTop }]}
            />
            <View
              style={[
                styles.maskPanel,
                { left: 0, width: frameLeft, top: frameTop, height: frameH },
              ]}
            />
            <View
              style={[
                styles.maskPanel,
                { right: 0, width: frameLeft, top: frameTop, height: frameH },
              ]}
            />
            <View
              style={[
                styles.maskPanel,
                { left: 0, right: 0, top: frameTop + frameH, bottom: 0 },
              ]}
            />

            {isSelfie ? (
              // Oval face guide
              <View
                style={{
                  position: "absolute",
                  left: frameLeft,
                  top: frameTop,
                  width: frameW,
                  height: frameH,
                  borderRadius: frameW / 2,
                  borderWidth: 2.5,
                  borderColor: withAlpha("#FFFFFF", 0.95),
                }}
              />
            ) : (
              <>
                {/* Card outline + corner brackets */}
                <View
                  style={{
                    position: "absolute",
                    left: frameLeft,
                    top: frameTop,
                    width: frameW,
                    height: frameH,
                    borderWidth: 1.5,
                    borderRadius: 14,
                    borderColor: withAlpha("#FFFFFF", 0.55),
                  }}
                />
                <View
                  style={[
                    styles.bracket,
                    { left: frameLeft - 4, top: frameTop - 4, borderLeftWidth: 4, borderTopWidth: 4, borderTopLeftRadius: 16 },
                  ]}
                />
                <View
                  style={[
                    styles.bracket,
                    { right: frameLeft - 4, top: frameTop - 4, borderRightWidth: 4, borderTopWidth: 4, borderTopRightRadius: 16 },
                  ]}
                />
                <View
                  style={[
                    styles.bracket,
                    { left: frameLeft - 4, bottom: screenH - frameTop - frameH - 4, borderLeftWidth: 4, borderBottomWidth: 4, borderBottomLeftRadius: 16 },
                  ]}
                />
                <View
                  style={[
                    styles.bracket,
                    { right: frameLeft - 4, bottom: screenH - frameTop - frameH - 4, borderRightWidth: 4, borderBottomWidth: 4, borderBottomRightRadius: 16 },
                  ]}
                />
              </>
            )}

            {/* hint pill */}
            <View
              style={[
                styles.hintPill,
                { top: frameTop + frameH + 18 },
              ]}
            >
              <Text style={styles.hintText}>{HINTS[docKind] || HINTS.id_front}</Text>
            </View>
          </View>
        ) : null}

        {/* top bar */}
        <View style={styles.topBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close camera"
            onPress={() => navigation.goBack()}
            style={styles.roundButton}
            disabled={busy}
          >
            <TabBarIcon name="x" color={colors.white} size={22} />
          </Pressable>

          <Text style={styles.topTitle}>
            {shot ? "Review photo" : isSelfie ? "Selfie check" : docKind === "id_front" ? "ID — front" : "ID — back"}
          </Text>

          {isId && !shot ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Toggle torch"
              onPress={() => setTorchOn((v) => !v)}
              style={[styles.roundButton, torchOn && styles.roundButtonOn]}
              disabled={busy}
            >
              <TabBarIcon
                name="zap"
                color={torchOn ? "#0B0F0C" : colors.white}
                size={20}
              />
            </Pressable>
          ) : (
            <View style={styles.roundButton} />
          )}
        </View>

        {/* processing overlay */}
        {busy ? (
          <View style={styles.busyOverlay}>
            <ActivityIndicator size="large" color={colors.white} />
            <Text style={styles.busyText}>
              {shot ? "Preparing photo…" : "Capturing…"}
            </Text>
          </View>
        ) : null}

        {/* bottom controls */}
        <View style={styles.bottomBar}>
          {error ? (
            <View style={styles.errorPill}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {shot ? (
            <View style={styles.reviewRow}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setShot(null)}
                style={[styles.reviewButton, styles.reviewButtonGhost]}
                disabled={busy}
              >
                <Text style={[styles.reviewButtonText, { color: colors.white }]}>
                  Retake
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={confirmShot}
                style={[styles.reviewButton, styles.reviewButtonPrimary]}
                disabled={busy}
              >
                <Text
                  style={[
                    styles.reviewButtonText,
                    { color: colors.white },
                  ]}
                >
                  Use photo
                </Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.captureRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Flip camera"
                onPress={flipCamera}
                style={styles.sideButton}
                disabled={busy}
              >
                <TabBarIcon name="refresh-cw" color={colors.white} size={22} />
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Take photo"
                onPress={takeShot}
                style={styles.shutterOuter}
                disabled={busy}
              >
                <View style={styles.shutterInner} />
              </Pressable>

              <View style={styles.sideButton} />
            </View>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#0B0F0C",
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
  },
  centerPad: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
  },
  permCard: {
    width: "100%",
    maxWidth: 420,
    alignItems: "center",
  },
  permTitle: {
    color: colors.white,
    fontSize: 19,
    fontWeight: "800",
    marginTop: 14,
  },
  permBody: {
    color: withAlpha("#FFFFFF", 0.75),
    fontSize: 13.5,
    lineHeight: 20,
    textAlign: "center",
    marginVertical: 12,
  },
  settingsLink: {
    marginTop: 16,
    paddingVertical: 8,
  },
  settingsLinkText: {
    color: withAlpha("#FFFFFF", 0.8),
    fontSize: 12.5,
    fontWeight: "700",
    textDecorationLine: "underline",
  },
  backLink: {
    marginTop: 10,
    paddingVertical: 8,
  },
  backLinkText: {
    color: withAlpha("#FFFFFF", 0.55),
    fontSize: 13,
    fontWeight: "700",
  },
  cameraShell: {
    flex: 1,
    overflow: "hidden",
    backgroundColor: "#000000",
  },
  maskPanel: {
    position: "absolute",
    backgroundColor: withAlpha("#000000", 0.58),
  },
  bracket: {
    position: "absolute",
    width: 36,
    height: 36,
    borderColor: colors.white,
  },
  hintPill: {
    position: "absolute",
    left: 22,
    right: 22,
    backgroundColor: withAlpha("#000000", 0.66),
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  hintText: {
    color: colors.white,
    fontSize: 12.5,
    lineHeight: 18,
    textAlign: "center",
    fontWeight: "600",
  },
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  topTitle: {
    color: colors.white,
    fontSize: 14,
    fontWeight: "800",
    textShadowColor: withAlpha("#000000", 0.55),
    textShadowRadius: 6,
  },
  roundButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: withAlpha("#000000", 0.45),
    alignItems: "center",
    justifyContent: "center",
  },
  roundButtonOn: {
    backgroundColor: colors.white,
  },
  busyOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: withAlpha("#000000", 0.55),
    alignItems: "center",
    justifyContent: "center",
  },
  busyText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: "700",
    marginTop: 12,
  },
  bottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 22,
    paddingBottom: 26,
    paddingTop: 14,
  },
  errorPill: {
    backgroundColor: withAlpha("#B3493E", 0.92),
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  errorText: {
    color: colors.white,
    fontSize: 12.5,
    fontWeight: "700",
    textAlign: "center",
  },
  captureRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sideButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: withAlpha("#000000", 0.45),
    alignItems: "center",
    justifyContent: "center",
  },
  shutterOuter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  shutterInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.white,
  },
  reviewRow: {
    flexDirection: "row",
    gap: 12,
  },
  reviewButton: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: "center",
  },
  reviewButtonGhost: {
    backgroundColor: withAlpha("#FFFFFF", 0.16),
  },
  reviewButtonPrimary: {
    backgroundColor: colors.brand,
  },
  reviewButtonText: {
    fontSize: 15,
    fontWeight: "800",
  },
});
