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
