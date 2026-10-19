// Signed-URL reuse cache (2026-10-20 perf round).
//
// The media host's view URLs are HMAC-signed with a ~5-minute TTL, so the
// SAME image gets a DIFFERENT URL on every signature. That has two hidden
// costs the app felt on lists and re-mounted screens:
//
//   1. every new signature is a new /api/media/:id/link round-trip
//      (SignedImage re-signs on every mount),
//   2. image bytes can't be served from the native Fresco/NSURL cache
//      because the cache key IS the URL — a new signature re-downloads.
//
// Fix: remember the last signed URL per (mediaId, variant) and keep reusing
// it while it is still fresh. SIGNATURE_TTL_MS mirrors the gateway's 300 s
// TTL; we reuse for 240 s so we never serve a signature in its last minute.
// Entries whose expiry passed are dropped lazily on access.

const SIGNATURE_TTL_MS = 5 * 60 * 1000; // gateway: buildSignedUrl(..., 300 s)
const REUSE_WINDOW_MS = 4 * 60 * 1000; // stop reusing 60 s before real expiry

const cache = new Map(); // "mediaId|variant" -> { url, cachedAt }

function key(mediaId, variant) {
  return `${mediaId}|${variant}`;
}

// Returns the cached URL when it is still safely inside its validity window.
export function peekCachedSignedUrl(mediaId, variant) {
  if (!mediaId) return null;

  const entry = cache.get(key(mediaId, variant));

  if (!entry) return null;

  if (Date.now() - entry.cachedAt > REUSE_WINDOW_MS) {
    cache.delete(key(mediaId, variant));
    return null;
  }

  return entry.url;
}

// Stores a freshly signed URL (from /link or a list payload) for reuse.
export function rememberSignedUrl(mediaId, variant, url) {
  if (!mediaId || !url) return;

  cache.set(key(mediaId, variant), { url, cachedAt: Date.now() });

  // Opportunistic hygiene — the map holds at most a few dozen rows in
  // practice, but a runaway session should never grow it unbounded.
  if (cache.size > 200) {
    const cutoff = Date.now() - REUSE_WINDOW_MS;

    for (const [k, v] of cache) {
      if (v.cachedAt < cutoff) cache.delete(k);
    }
  }
}

// True when the candidate URL differs from what we already hold for this
// media but our held copy is still fresh — the caller should keep the held
// copy (stable URL = warm image cache) instead of churn.
export function shouldPreferCachedUrl(mediaId, variant, candidateUrl) {
  if (!mediaId || !candidateUrl) return false;

  const held = peekCachedSignedUrl(mediaId, variant);

  return Boolean(held) && held !== candidateUrl;
}

export const __TTL_FOR_TESTS = { SIGNATURE_TTL_MS, REUSE_WINDOW_MS };
