import { apiRequest } from "../config/api";

// Thin wrappers over the HelpNest auth endpoints (PRD §12.2).
// Each resolves with the parsed JSON body or throws an Error with a
// user-friendly message produced by the API client.

export function signUp(payload) {
  return apiRequest("/api/auth/signup", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function login(identifier, password) {
  return apiRequest("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ identifier, password }),
  });
}

export function sendOtp(phone) {
  return apiRequest("/api/auth/otp/send", {
    method: "POST",
    body: JSON.stringify({ phone }),
  });
}

export function verifyOtp(phone, code) {
  return apiRequest("/api/auth/otp/verify", {
    method: "POST",
    body: JSON.stringify({ phone, code }),
  });
}

export function refreshSession(refreshToken) {
  return apiRequest("/api/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refreshToken }),
    // Never auto-retry the refresh call itself — a failed rotation must
    // surface to AuthContext so it can end the session cleanly.
    skipAuthRetry: true,
  });
}

export async function fetchMe() {
  const data = await apiRequest("/api/auth/me");
  return { userData: data.user };
}

export function logout() {
  return apiRequest("/api/auth/logout", {
    method: "POST",
    // Best-effort revocation — the local session is cleared regardless,
    // so there is nothing useful to refresh-and-retry here.
    skipAuthRetry: true,
  });
}
