import { apiRequest } from "../config/api";

// Full entitlement snapshot for the signed-in user (PRD §14.7): reconciles
// any missed payment grants server-side, then returns the active plan and
// credit balances for the caller's role.
//   maid     -> credits.apply, canApply, applyReason
//   employer -> credits.chat / credits.jobPost, canPostJob, postReason
export function getEntitlements() {
  return apiRequest("/api/entitlements/me");
}
