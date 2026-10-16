import { apiRequest } from "../config/api";

// Profile updates (location + worker profile) — PATCH /api/users/me.
export function updateMe(payload) {
  return apiRequest("/api/users/me", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}
