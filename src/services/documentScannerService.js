// ML Kit Document Scanner service (Task 57 — free Google Play services API,
// $0 licensing, on-device processing; PRD §4.2 follow-up to the math
// auto-crop in KYCCameraScreen).
//
// What it adds over the guided camera: automatic edge detection, automatic
// capture, glare/stain cleaning and shadow removal — all inside Google's
// scanner UI, delivered via Play services (~300KB app-size impact, models
// downloaded on demand).
//
// Platform reality (deliberate design, not defensive padding):
//   - Android only. ML Kit has no iOS document scanner (Google limitation);
//     iOS keeps the guided camera until a VisionKit wrapper lands.
//   - The wrapper resolves its native module with requireNativeModule at
//     IMPORT time, which throws when the module isn't compiled in (Expo Go,
//     a JS bundle ahead of the native build). So the wrapper is loaded via
//     a deferred dynamic import() inside the call — the failure is then a
//     catchable rejection, never a red screen, and the caller falls back to
//     the guided camera.
//
// Result contract:
//   { ok: false }            scanner can't run here -> caller navigates to
//                            the guided camera (the pre-Task-57 behavior)
//   { ok: true, canceled }   user backed out of the scanner -> caller does
//                            nothing (opening the camera would be rude)
//   { ok: true, uri }        single scanned page, normalized through the
//                            same <=1600px JPEG q0.8 pipeline as the camera

import { Image, Platform } from "react-native";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

// Scan a single ID page. Never throws — every failure mode maps onto the
// result contract above so the UI flow always has a next step.
export async function scanDocumentPage() {
  if (Platform.OS !== "android") return { ok: false };

  let scanner;

  try {
    // Deferred load: executes the wrapper's requireNativeModule only now —
    // in Expo Go / iOS this rejects and we fall back instead of crashing.
    scanner = await import("@infinitered/react-native-mlkit-document-scanner");
  } catch {
    return { ok: false };
  }

  let result;

  try {
    result = await scanner.launchDocumentScannerAsync({
      // KYC documents are single-page; gallery imports go through the app's
      // own picker + ImageReview path, so they're off in the scanner UI.
      pageLimit: 1,
      galleryImportAllowed: false,
      // FULL adds the ML-enabled cleaning (stains, glare, shadows) on top of
      // crop/rotate/filters — exactly what reviewers asked the hints to
      // promise.
      scannerMode: scanner.ScannerModeOptions.FULL,
      resultFormats: scanner.ResultFormatOptions.JPEG,
    });
  } catch {
    // Play services couldn't provide the scanner (module not installed,
    // unsupported device, user declined the on-demand download).
    return { ok: false };
  }

  if (!result || result.canceled || !Array.isArray(result.pages) || !result.pages.length) {
    return { ok: true, canceled: true };
  }

  return { ok: true, uri: await normalizeScanUri(result.pages[0]) };
}

// Scanner output has no reported dimensions, so probe them cheaply and run
// the same <=1600px long-edge / JPEG q0.8 tail the guided camera uses before
// upload. Any probe/encode miss hands the raw page through — Play services
// pages are already sane JPEGs and the gateway ceiling is 8 MB.
async function normalizeScanUri(uri) {
  try {
    const dims = await new Promise((resolve, reject) => {
      Image.getSize(uri, (w, h) => resolve({ w, h }), reject);
    });

    const long = Math.max(dims.w, dims.h);

    if (!long || long <= 1600) return uri;

    const context = ImageManipulator.manipulate(uri).resize(
      long === dims.w ? { width: 1600 } : { height: 1600 }
    );
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

    return saved?.uri || uri;
  } catch {
    return uri;
  }
}
