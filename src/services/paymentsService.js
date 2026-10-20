import { apiRequest } from "../config/api";

// M-Pesa STK push (PRD §11.2). The client only ever sends the plan id —
// the amount is still looked up server-side. `metadata` carries plan-
// specific attribution, e.g. { workerId } for contact_unlock so the
// backend knows WHICH worker's contact the payer unlocked.
export function startStkPush(plan, metadata) {
  return apiRequest("/api/payments/stk/push", {
    method: "POST",
    body: JSON.stringify({ plan, ...(metadata || {}) }),
  });
}

// Poll a transaction until success / failed / timeout.
export function getTransaction(txnId) {
  return apiRequest(`/api/payments/txn/${txnId}`);
}

// Purchase history (PRD §14.7 receipts) — reconciles missed callbacks
// server-side first, then returns the last 100 transactions with outcome
// vocabulary and refund status.
export function fetchHistory() {
  return apiRequest("/api/payments/history");
}

// "Get help" on a purchase (PRD §14.7): file a refund request that the
// team handles manually (approve -> till reversal -> reference recorded).
export function requestRefund(txnId, reason) {
  return apiRequest(`/api/payments/txn/${txnId}/refund-request`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}
