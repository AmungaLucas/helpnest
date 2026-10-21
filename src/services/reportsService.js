import { apiRequest } from "../config/api";

// User reports (PRD v1.0 §10.2) — flag a profile or a job for human
// moderation. One open report per reporter/target/category; the reporter is
// notified when the dashboard team decides (§17), and the reported user is
// never told who reported them (§17.2). Categories mirror the gateway enum.
export const REPORT_CATEGORIES = [
  { value: "fraud", label: "Fraud or scam" },
  { value: "harassment", label: "Harassment or abuse" },
  { value: "inappropriate", label: "Inappropriate content" },
  { value: "spam", label: "Spam" },
  { value: "safety", label: "Safety concern" },
  { value: "other", label: "Something else" },
];

// -> { success, message, reportId }
export function fileReport({ targetUserId, targetJobId, category, note }) {
  return apiRequest("/api/reports", {
    method: "POST",
    body: JSON.stringify({
      ...(targetUserId ? { targetUserId } : {}),
      ...(targetJobId ? { targetJobId } : {}),
      category,
      note,
    }),
  });
}
