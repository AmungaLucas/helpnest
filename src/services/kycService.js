import { apiRequest } from "../config/api";

// KYC verification (PRD §4.2, §10.2) — submit + status.
//
// Flow: upload three images through the media API first (kinds
// "kyc_id_front" | "kyc_id_back" | "kyc_selfie" via services/mediaService),
// then submit the three media ids here. Status flips to "pending"; review
// happens server-side within the 24h SLA.

// -> { success, kycStatus, documents: { idFront, idBack, selfie }, lastSubmittedAt }
export function getKycStatus() {
  return apiRequest("/api/kyc/status");
}

// -> { success, message, kycStatus: "pending" }
export function submitKyc({ idFront, idBack, selfie }) {
  return apiRequest("/api/kyc/submit", {
    method: "POST",
    body: JSON.stringify({ idFront, idBack, selfie, consent: true }),
  });
}
