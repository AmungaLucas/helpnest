import { apiRequest } from "../config/api";
import { buildMultipartBody, createBoundary } from "./multipart";

// Media upload + signed-URL helpers (Wave 2, W2-B3).
//
// Uploads always flow through the authenticated API. Viewing uses short-lived
// HMAC-signed URLs that the API issues after a permission check — see
// BUILD-PLAN.md W2-B3 for the full security model.

// kinds: "profile" | "kyc_id_front" | "kyc_id_back" | "kyc_selfie"
// `uri` must be a local file URI from expo-image-picker. The picker screens
// pass allowsEditing + quality so the OS re-encodes to JPEG (avoids HEIC,
// which the server rejects) and bakes EXIF orientation into pixels.
//
// Why not FormData? Expo SDK 57's runtime made every serializer path fail on
// device: winter's converter throws "Unsupported FormDataPart implementation"
// for legacy {uri} parts, and RN's global Blob constructor throws on binary
// parts ("Creating blobs from 'ArrayBuffer' ... not supported"). So v3 reads
// the file natively and builds the multipart body by hand — see
// ./multipart.js for the rationale. Server-side multer cannot tell the
// difference.

/**
 * Reads the picked file into bytes.
 *
 * Primary: expo-file-system's File.arrayBuffer() — a direct native read, no
 * HTTP stack involved, so it cannot hang the way fetch(file://) can.
 * Fallback: expo fetch with its file:// interceptor, guarded by a timeout so
 * an unresponsive read can never stall the upload silently.
 */
async function readImageBytes(uri) {
  try {
    const { File } = require("expo-file-system");
    const file = new File(uri);
    const buffer = await file.arrayBuffer();
    if (buffer && buffer.byteLength > 0) return new Uint8Array(buffer);
  } catch (error) {
    if (__DEV__) {
      console.log("[MEDIA] native read failed, falling back to fetch:", error?.message);
    }
  }

  const response = await Promise.race([
    fetch(uri),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("reading the file timed out")), 10000)
    ),
  ]);
  const buffer = await response.arrayBuffer();
  return new Uint8Array(buffer);
}

export async function uploadMedia({ uri, kind, timeoutMs = 60000 }) {
  // Dev-only marker: proves the device bundle contains this uploader.
  if (__DEV__) {
    console.log("[MEDIA] uploader v3 (native read + manual multipart):", String(uri).slice(0, 64));
  }

  let bytes;
  try {
    bytes = await readImageBytes(uri);
  } catch (error) {
    throw new Error(
      "Could not read the selected image from device storage. Pick the photo again and retry."
    );
  }

  if (!bytes || bytes.length === 0) {
    throw new Error("The selected image could not be read (0 bytes). Try a different photo.");
  }

  const boundary = createBoundary();
  const body = buildMultipartBody({
    boundary,
    fields: { kind },
    file: {
      name: "file",
      filename: `helpnest-${kind}-${Date.now()}.jpg`,
      contentType: "image/jpeg",
      bytes,
    },
  });

  return apiRequest("/api/media/upload", {
    method: "POST",
    body, // Uint8Array — accepted directly by expo fetch
    timeoutMs,
    // Overrides api.js's JSON default (its header spread runs ours last).
    // Winter fetch does NOT auto-set a boundary for non-FormData bodies.
    headers: { "Content-Type": `multipart/form-data; boundary=${boundary}` },
  });
}

// Exchanges a media id for a signed URL (~5 min TTL). variant: "thumb" | "display".
export async function getMediaLink(mediaId, variant = "display") {
  const data = await apiRequest(`/api/media/${mediaId}/link?v=${variant}`);
  return data.url;
}
