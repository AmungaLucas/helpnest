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

/**
 * The shared host runs LiteSpeed bot verification server-wide (ticket
 * #JTB-448682). It challenges requests that do not present a browser-like
 * User-Agent, which native fetch clients cannot solve. Until the host
 * confirms the site-level `LsRecaptcha 0` disable (already added to
 * public_html/.htaccess) has taken effect, we send a browser User-Agent.
 * Revisit this once /api/health passes WITHOUT it, then remove both this
 * header and the challenge-detection branch below.
 */
const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36";

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
        "User-Agent": BROWSER_USER_AGENT,
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
    if (/lsrecaptcha|bot verification/i.test(rawBody)) {
      throw new Error(
        "The API gateway is temporarily bot-verifying requests. Please try again later."
      );
    }

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
