import { apiRequest } from "../config/api";

// Browse search-ready domestic workers (PRD §6).
// limit/offset power the Find Help list's lazy loading (server clamps
// limit to 1-60; hasMore = the page came back full).
export function listWorkers({ service, query, limit, offset } = {}) {
  const params = new URLSearchParams();

  if (service) params.set("service", service);
  if (query) params.set("q", query);
  if (limit) params.set("limit", String(limit));
  if (offset) params.set("offset", String(offset));

  const qs = params.toString();

  return apiRequest(`/api/workers${qs ? `?${qs}` : ""}`);
}

// Public worker profile — includes phone only when the caller's
// contact unlock payment has succeeded.
export function getWorker(workerId) {
  return apiRequest(`/api/workers/${workerId}`);
}

// A maid's own work profile (any state, even before search-ready).
export function getMyWorkerProfile() {
  return apiRequest("/api/workers/me");
}
