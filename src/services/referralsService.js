import { apiRequest } from "../config/api";

// Referral programme (earn cash when people you invite sign up AND pay).
// One round trip: lazily issues the caller's invite code, returns the
// reward rules, earnings snapshot and the recent referral list.
export function getMyReferrals() {
  return apiRequest("/api/referrals/me");
}
