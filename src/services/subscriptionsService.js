import { apiRequest } from "../config/api";

// Chat subscription status for the signed-in user — derived server-side
// from successful chat_week / chat_month M-Pesa transactions.
export function getSubscriptionStatus() {
  return apiRequest("/api/subscriptions/status");
}

// Can the caller open a chat with this worker right now? Returns
// { canChat, reason: "subscription"|"pass"|null, hasSubscription, expiresAt }.
export function getChatAccess(workerId) {
  return apiRequest(`/api/subscriptions/chat-access/${workerId}`);
}
