import { apiRequest } from "../config/api";

/**
 * HelpNest Secure Chat — gateway client (BUILD 2026-10-20.14, /api/chat).
 *
 * Error bodies are surfaced: paywall responses (HTTP 402) carry
 * { reason, details: { options } } — callers read e.body.reason /
 * e.body.details.options to drive the unlock UI (PRD §13.3c / §9.7).
 */

export function registerChatKey(publicKey, alg) {
  return apiRequest("/api/chat/keys", {
    method: "POST",
    body: JSON.stringify({ publicKey, ...(alg ? { alg } : {}) }),
  });
}

export function listConversations() {
  return apiRequest("/api/chat/conversations");
}

/**
 * §13.3 create-or-open. mode:
 *   'open'   — standard entry; creates a NEW conversation only when an
 *              entitlement can be reserved (402 otherwise)
 *   'unlock' — post-purchase: applies a chat_pass for THIS maid to the
 *              existing conversation
 * Resolves the payload { created, consumed, paywall, conversation }.
 */
export function ensureConversation(workerId, mode = "open") {
  return apiRequest("/api/chat/conversations", {
    method: "POST",
    body: JSON.stringify({ workerId, mode }),
  });
}

export function getConversation(conversationId) {
  return apiRequest(`/api/chat/conversations/${conversationId}`);
}

export function getMessages(conversationId, { afterSeq, beforeSeq, limit } = {}) {
  const params = [];

  if (afterSeq !== undefined && afterSeq !== null) params.push(`afterSeq=${afterSeq}`);
  if (beforeSeq !== undefined && beforeSeq !== null) params.push(`beforeSeq=${beforeSeq}`);
  if (limit) params.push(`limit=${limit}`);

  const qs = params.length > 0 ? `?${params.join("&")}` : "";

  return apiRequest(`/api/chat/conversations/${conversationId}/messages${qs}`);
}

/**
 * Delivers a sealed envelope. payload:
 *   { type:'text'|'contact_card', nonce, cipher, charLen, field?, flag? }
 * flag (from utils/contactGuard) drives the §10.5 enforcement ledger.
 */
export function sendMessage(conversationId, payload) {
  return apiRequest(`/api/chat/conversations/${conversationId}/messages`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function markRead(conversationId, seq) {
  return apiRequest(`/api/chat/conversations/${conversationId}/read`, {
    method: "POST",
    body: JSON.stringify({ seq }),
  });
}

export function closeConversation(conversationId) {
  return apiRequest(`/api/chat/conversations/${conversationId}/close`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function blockConversation(conversationId) {
  return apiRequest(`/api/chat/conversations/${conversationId}/block`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function reportConversation(conversationId, { reason, messageSeq, detail }) {
  return apiRequest(`/api/chat/conversations/${conversationId}/report`, {
    method: "POST",
    body: JSON.stringify({
      reason,
      ...(messageSeq ? { messageSeq } : {}),
      ...(detail ? { detail } : {}),
    }),
  });
}

export function grantConsent(conversationId, field) {
  return apiRequest("/api/chat/consent", {
    method: "POST",
    body: JSON.stringify({ conversationId, field }),
  });
}

export function revokeConsent(conversationId, field) {
  return apiRequest("/api/chat/consent/revoke", {
    method: "POST",
    body: JSON.stringify({ conversationId, field }),
  });
}

export function setNotAcceptingChats(enabled) {
  return apiRequest("/api/chat/not-accepting", {
    method: "POST",
    body: JSON.stringify({ enabled }),
  });
}
