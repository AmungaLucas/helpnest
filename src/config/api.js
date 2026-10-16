/**
 * Minimal JSON API client for HelpNest.
 *
 * - Base URL comes from EXPO_PUBLIC_API_URL (see .env.example) so it can be
 *   overridden per environment without touching code.
 * - Console diagnostics only run in development builds (__DEV__), so response
 *   bodies never leak into production device logs.
 * - Requests abort after `timeoutMs` (default 15s) so the UI never hangs forever.
 */

const DEFAULT_BASE_URL = "https://gateway.jobready.co.ke";
const DEFAULT_TIMEOUT_MS = 15000;

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || DEFAULT_BASE_URL;

export async function apiRequest(path, options = {}) {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, ...fetchOptions } = options;
  const url = `${API_BASE_URL}${path}`;

  if (__DEV__) {
    console.log("[API REQUEST]", url);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let response;

  try {
    response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...(fetchOptions.body ? { "Content-Type": "application/json" } : {}),
        ...fetchOptions.headers,
      },
    });
  } catch (error) {
    const timedOut = error && error.name === "AbortError";
    if (__DEV__) {
      console.log(
        "[API NETWORK ERROR]",
        timedOut ? "request timed out" : error.message
      );
    }
    throw new Error(
      timedOut
        ? "The request timed out. Check your connection and try again."
        : `Network error: ${error.message}`
    );
  } finally {
    clearTimeout(timeoutId);
  }

  const contentType = response.headers.get("content-type") || "";
  const rawBody = await response.text();

  if (__DEV__) {
    console.log("[API STATUS]", response.status);
    console.log("[API CONTENT TYPE]", contentType);
    console.log("[API RAW RESPONSE]", rawBody);
  }

  if (!contentType.toLowerCase().includes("application/json")) {
    throw new Error(
      `Expected JSON but received ${contentType || "unknown content type"}.`
    );
  }

  let data;

  try {
    data = JSON.parse(rawBody);
  } catch {
    throw new Error("The API returned invalid JSON.");
  }

  if (!response.ok) {
    throw new Error(
      data.message || `Request failed: HTTP ${response.status}`
    );
  }

  return data;
}

export function testApiHealth() {
  return apiRequest("/api/health");
}
