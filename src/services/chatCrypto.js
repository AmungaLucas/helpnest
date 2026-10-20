/**
 * HelpNest Secure Chat — client-side end-to-end encryption (v1).
 *
 * WIRE CONTRACT (mirrored server-side in services/chat.js comments and
 * verified against Node's built-in crypto in the gateway build test):
 *   identity  X25519 keypair; PRIVATE key lives ONLY in the device keystore
 *             (expo-secure-store). The public half is registered at
 *             POST /api/chat/keys as 32-byte hex.
 *   conv key  HKDF-SHA256(ikm = ECDH(myPriv, peerPub),
 *                        salt = conversationId (utf8),
 *                        info = "hn-chat-v1", L = 32)
 *   message   ChaCha20-Poly1305 (RFC 8439): 12-byte random nonce,
 *             ciphertext||16-byte tag, base64 on the wire.
 *
 * The gateway stores nonce + ciphertext + length metadata only — it can
 * never read message bodies (PRD §10 note: contact masking therefore runs
 * HERE, on the sender's device, before sealing; see utils/contactGuard.js).
 *
 * Pure-JS crypto via @noble/curves|hashes|ciphers — no native modules, safe
 * in Expo Go. Randomness comes from expo-crypto (CSPRNG) passed in
 * explicitly, so noble never needs a global crypto polyfill.
 */

import { x25519 } from "@noble/curves/ed25519";
import { hkdf } from "@noble/hashes/hkdf";
import { sha256 } from "@noble/hashes/sha256";
import { chacha20poly1305 } from "@noble/ciphers/chacha";
import { bytesToHex, hexToBytes, utf8ToBytes } from "@noble/ciphers/utils";

const ALG = "x25519-hkdf-sha256-chacha20poly1305-v1";
const HKDF_INFO = utf8ToBytes("hn-chat-v1");
const KEYSTORE_KEY = "hn_chat_identity_priv_v1";

// ---------------------------------------------------------------------------
// base64 (Hermes has no atob/btoa; noble 1.3 utils has no b64 either)
// ---------------------------------------------------------------------------

const B64_CHARS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

const B64_REV = (() => {
  const map = {};
  for (let i = 0; i < B64_CHARS.length; i += 1) map[B64_CHARS[i]] = i;
  return map;
})();

export function bytesToBase64(bytes) {
  let out = "";
  let i = 0;

  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    out +=
      B64_CHARS[(n >> 18) & 63] +
      B64_CHARS[(n >> 12) & 63] +
      B64_CHARS[(n >> 6) & 63] +
      B64_CHARS[n & 63];
  }

  const rem = bytes.length - i;

  if (rem === 1) {
    const n = bytes[i] << 16;
    out += B64_CHARS[(n >> 18) & 63] + B64_CHARS[(n >> 12) & 63] + "==";
  } else if (rem === 2) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8);
    out +=
      B64_CHARS[(n >> 18) & 63] +
      B64_CHARS[(n >> 12) & 63] +
      B64_CHARS[(n >> 6) & 63] +
      "=";
  }

  return out;
}

export function base64ToBytes(str) {
  const clean = String(str || "").replace(/=+$/, "");
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let p = 0;
  let buf = 0;
  let bits = 0;

  for (let i = 0; i < clean.length; i += 1) {
    const v = B64_REV[clean[i]];
    if (v === undefined) throw new Error("Invalid base64 character.");
    buf = (buf << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[p] = (buf >> bits) & 0xff;
      p += 1;
    }
  }

  return p === out.length ? out : out.subarray(0, p);
}

// ---------------------------------------------------------------------------
// randomness (explicit CSPRNG — never noble's global crypto dependency)
// ---------------------------------------------------------------------------

function randomBytes(n) {
  // expo-crypto: synchronous CSPRNG on-device. Lazy require keeps this
  // module importable in plain Node for the wire-format test.
  let expoCrypto;

  try {
    // eslint-disable-next-line global-require
    expoCrypto = require("expo-crypto");
  } catch (error) {
    throw new Error("No secure randomness available (expo-crypto missing).");
  }

  return expoCrypto.getRandomBytes(n);
}

// ---------------------------------------------------------------------------
// identity (device keystore)
// ---------------------------------------------------------------------------

let identityCache = null; // { privHex, pubHex }

function privBytesFromHex(hex) {
  return hexToBytes(hex);
}

/**
 * Ensures this device has an X25519 identity. Returns { pubHex, created }.
 * Safe to call repeatedly; the keypair is generated once and persisted.
 */
export async function ensureIdentity() {
  if (identityCache) return { ...identityCache, created: false };

  let SecureStore;

  try {
    // eslint-disable-next-line global-require
    SecureStore = require("expo-secure-store");
  } catch (error) {
    throw new Error("Secure storage unavailable (expo-secure-store missing).");
  }

  const stored = await SecureStore.getItemAsync(KEYSTORE_KEY);

  if (stored && /^[0-9a-f]{64}$/.test(stored)) {
    const privHex = stored;
    const pubHex = bytesToHex(x25519.getPublicKey(privBytesFromHex(privHex)));
    identityCache = { privHex, pubHex };
    return { ...identityCache, created: false };
  }

  const priv = randomBytes(32);
  const privHex = bytesToHex(priv);
  const pubHex = bytesToHex(x25519.getPublicKey(priv));

  await SecureStore.setItemAsync(KEYSTORE_KEY, privHex, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });

  identityCache = { privHex, pubHex };
  return { ...identityCache, created: true };
}

export function identityPublicKey() {
  return identityCache ? identityCache.pubHex : null;
}

export const ALGORITHM = ALG;

// ---------------------------------------------------------------------------
// conversation keys (ECDH -> HKDF), cached per conversation per session
// ---------------------------------------------------------------------------

const convKeyCache = new Map(); // convId -> Uint8Array(32)

export function deriveConversationKey(conversationId, peerPubHex) {
  if (!identityCache) throw new Error("Chat identity not initialised.");
  if (!/^[0-9a-fA-F]{64}$/.test(peerPubHex || "")) {
    throw new Error("Peer has no encryption key yet.");
  }

  const cacheKey = `${conversationId}:${peerPubHex.toLowerCase()}`;
  const hit = convKeyCache.get(cacheKey);
  if (hit) return hit;

  const shared = x25519.getSharedSecret(
    privBytesFromHex(identityCache.privHex),
    hexToBytes(peerPubHex)
  );

  const key = hkdf(sha256, shared, utf8ToBytes(conversationId), HKDF_INFO, 32);
  convKeyCache.set(cacheKey, key);

  return key;
}

function convKey(conversationId, peerPubHex) {
  return deriveConversationKey(conversationId, peerPubHex);
}

// ---------------------------------------------------------------------------
// seal / open
// ---------------------------------------------------------------------------

/**
 * Encrypts a plaintext string for the given conversation.
 * Returns { nonce, cipher } — 24-hex nonce + base64(ct||tag).
 */
export function seal(conversationId, peerPubHex, plaintext) {
  const key = convKey(conversationId, peerPubHex);
  const nonce = randomBytes(12);
  const sealed = chacha20poly1305(key, nonce).encrypt(
    utf8ToBytes(String(plaintext))
  );

  return { nonce: bytesToHex(nonce), cipher: bytesToBase64(sealed) };
}

/**
 * Decrypts a message envelope. Throws on tamper/wrong key — callers show
 * a "[unable to decrypt]" placeholder instead of crashing the thread.
 */
export function openEnvelope(conversationId, peerPubHex, { nonce, cipher }) {
  const key = convKey(conversationId, peerPubHex);
  const raw = base64ToBytes(cipher);

  const opened = chacha20poly1305(key, hexToBytes(nonce)).decrypt(raw);

  return bytesToUtf8Safe(opened);
}

function bytesToUtf8Safe(bytes) {
  // utf8ToBytes exists in utils; decode via TextDecoder if present, else
  // manual UTF-8 decode (Hermes ships TextDecoder since 0.74 — belt+braces).
  if (typeof TextDecoder !== "undefined") {
    return new TextDecoder().decode(bytes);
  }

  let out = "";
  let i = 0;

  while (i < bytes.length) {
    const b = bytes[i];
    let cp = b;
    let len = 1;

    if (b >= 0xf0) {
      cp = b & 0x07;
      len = 4;
    } else if (b >= 0xe0) {
      cp = b & 0x0f;
      len = 3;
    } else if (b >= 0xc0) {
      cp = b & 0x1f;
      len = 2;
    }

    for (let k = 1; k < len && i + k < bytes.length; k += 1) {
      cp = (cp << 6) | (bytes[i + k] & 0x3f);
    }

    i += len;
    out += String.fromCodePoint(cp);
  }

  return out;
}

// System notices are platform boilerplate stored as plaintext JSON.
export function decodeSystemMessage(cipherJson) {
  try {
    const parsed = JSON.parse(cipherJson);
    return typeof parsed.text === "string" ? parsed.text : cipherJson;
  } catch (error) {
    return cipherJson;
  }
}
