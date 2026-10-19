import { apiRequest } from "../config/api";

// Employer household profile (PRD §12.1) — GET/PUT /api/employers/me.
// Fields: householdSize (1-30), numberOfChildren (0-20), bio (<=1000 chars).
// Send null for a field to clear it.
export function getMyEmployerProfile() {
  return apiRequest("/api/employers/me");
}

export function updateMyEmployerProfile(payload) {
  return apiRequest("/api/employers/me", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}
