import { apiRequest } from "../config/api";

// M-Pesa STK push (PRD §11.2). The client only ever sends the plan id —
// the amount is looked up server-side.
export function startStkPush(plan) {
  return apiRequest("/api/payments/stk/push", {
    method: "POST",
    body: JSON.stringify({ plan }),
  });
}

// Poll a transaction until success / failed / timeout.
export function getTransaction(txnId) {
  return apiRequest(`/api/payments/txn/${txnId}`);
}
