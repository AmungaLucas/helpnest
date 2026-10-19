import { apiRequest } from "../config/api";

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
// Expo SDK 57's fetch runtime (expo/winter) serializes FormData itself and
// does NOT support the legacy {uri, name, type} file parts — fetch() rejects
// them with "Unsupported FormDataPart implementation" (see expo/winter
// convertFormData.ts). The supported path: read the picked file into bytes,
// wrap them in a Blob and append it with a filename as the 3rd argument —
// the serialized part then carries filename + content-type, so the server's
// multer sees a proper file field.
export async function uploadMedia({ uri, kind, timeoutMs = 60000 }) {
  // Dev-only marker: proves the device bundle contains this uploader. If this
  // line does NOT appear when saving, the phone is running stale JS (see
  // "Unsupported FormDataPart implementation" = the old {uri} file part).
  if (__DEV__) {
    console.log("[MEDIA] uploader v2 (Blob part), reading:", String(uri).slice(0, 64));
  }

  let bytes;
  try {
    const response = await fetch(uri);
    bytes = await response.arrayBuffer();
  } catch (error) {
    throw new Error(
      "Could not read the selected image from device storage. Pick the photo again and retry."
    );
  }

  const blob = new Blob([bytes], { type: "image/jpeg" });

  if (blob.size === 0) {
    throw new Error("The selected image could not be read (0 bytes). Try a different photo.");
  }

  const form = new FormData();
  form.append("kind", kind);
  form.append("file", blob, `helpnest-${kind}-${Date.now()}.jpg`);

  return apiRequest("/api/media/upload", {
    method: "POST",
    body: form,
    timeoutMs,
  });
}

// Exchanges a media id for a signed URL (~5 min TTL). variant: "thumb" | "display".
export async function getMediaLink(mediaId, variant = "display") {
  const data = await apiRequest(`/api/media/${mediaId}/link?v=${variant}`);
  return data.url;
}
