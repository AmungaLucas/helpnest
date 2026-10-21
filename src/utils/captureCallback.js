/**
 * Capture-callback registry — serializable navigation params.
 *
 * KYCCamera / ImageReview used to receive their "hand the photo back"
 * callbacks directly via route.params (params.onCaptured / params.onUse).
 * React Navigation state must be serializable, and functions in params
 * trigger the "Non-serializable values were found in the navigation state"
 * warning and can break state persistence (React Navigation
 * troubleshooting: pass callbacks through a store instead of params).
 *
 * Pattern: the caller registers its callback, passes the short-lived id as
 * a param, and the capture screen takes (and releases) it once. Entries are
 * single-use — a cancelled capture simply leaves the id unconsumed and the
 * entry is garbage-collected with the caller's closure.
 */

const registry = new Map();
let nextId = 1;

/**
 * Register a callback for one capture session. Returns the id to pass as a
 * navigation param (e.g. `navigate("KYCCamera", { docKind, captureId })`).
 */
export function registerCaptureCallback(fn) {
  const id = `cap_${Date.now().toString(36)}_${(nextId += 1)}`;

  registry.set(id, fn);

  return id;
}

/**
 * Consume a registered callback. Returns the function and REMOVES it from
 * the registry (single-use by design). Returns null for unknown/expired ids.
 */
export function takeCaptureCallback(id) {
  if (!id || !registry.has(id)) return null;

  const fn = registry.get(id);

  registry.delete(id);

  return typeof fn === "function" ? fn : null;
}
