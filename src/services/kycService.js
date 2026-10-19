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
// Partial resubmission: after a rejection the reviewer may have APPROVED some
// documents — the app then sends only the retaken ones (>= 1). A first
// submission (unverified) still sends all three; the server enforces both.
export function submitKyc({ idFront, idBack, selfie }) {
  const body = { consent: true };

  if (idFront) body.idFront = idFront;
  if (idBack) body.idBack = idBack;
  if (selfie) body.selfie = selfie;

  return apiRequest("/api/kyc/submit", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
