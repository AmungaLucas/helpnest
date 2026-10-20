import { apiRequest } from "../config/api";

// Appeals (PRD v1.1 §4.7/§15.3/§15.6) — user appeals against KYC
// rejections, suspensions and chat restrictions. Decisions are made by a
// second reviewer on the dashboard within the 72-hour target.

// -> { success, message, appealId }
export function fileAppeal({ kind, message, targetId }) {
  return apiRequest("/api/appeals", {
    method: "POST",
    body: JSON.stringify({ kind, message, ...(targetId ? { targetId } : {}) }),
  });
}

// -> { success, appeals: [{ id, kind, status, decisionNote, ... }] }
export function getMyAppeals() {
  return apiRequest("/api/appeals/me");
}
