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
  const response = await fetch(uri);
  const bytes = await response.arrayBuffer();
  const blob = new Blob([bytes], { type: "image/jpeg" });

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
