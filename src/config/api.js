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

// Set by AuthContext after login / OTP verification. Attached to every
// request as a Bearer header until the user signs out.
let authToken = null;

export function setAuthToken(token) {
  authToken = token;
}

// Set by AuthContext: called when a request comes back 401 so the context
// can rotate the refresh token. Returning true makes the original request
// retry once with the fresh access token.
let authEventHandler = null;

export function setAuthEventHandler(handler) {
  authEventHandler = typeof handler === "function" ? handler : null;
}

function apiError(message, { status, isNetwork } = {}) {
  const error = new Error(message);
  if (status !== undefined) error.status = status;
  if (isNetwork) error.isNetwork = true;
  return error;
}

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
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        // FormData bodies must NOT get a JSON content-type — the runtime
        // needs to set multipart/form-data with its own boundary itself.
        ...(fetchOptions.body && !(fetchOptions.body instanceof FormData)
          ? { "Content-Type": "application/json" }
          : {}),
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
    throw apiError(
      timedOut
        ? "The request timed out. Check your connection and try again."
        : `Network error: ${error.message}`,
      { isNetwork: true }
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
      throw apiError(
        "The API gateway is temporarily bot-verifying requests. Please try again later.",
        { isNetwork: true }
      );
    }

    throw apiError(
      `Expected JSON but received ${contentType || "unknown content type"}.`,
      { isNetwork: true }
    );
  }

  let data;

  try {
    data = JSON.parse(rawBody);
  } catch {
    throw apiError("The API returned invalid JSON.", { isNetwork: true });
  }

  if (!response.ok) {
    // Access token expired (12h) — rotate the refresh token once and retry
    // the original request transparently. skipAuthRetry breaks any loop.
    if (
      response.status === 401 &&
      !options.skipAuthRetry &&
      authEventHandler
    ) {
      const recovered = await authEventHandler();

      if (recovered) {
        return apiRequest(path, { ...options, skipAuthRetry: true });
      }
    }

    throw apiError(
      data.message || `Request failed: HTTP ${response.status}`,
      { status: response.status }
    );
  }

  return data;
}

export function testApiHealth() {
  return apiRequest("/api/health");
}
