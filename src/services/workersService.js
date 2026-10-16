import { apiRequest } from "../config/api";

// Browse search-ready domestic workers (PRD §6).
export function listWorkers({ service, query } = {}) {
  const params = new URLSearchParams();

  if (service) params.set("service", service);
  if (query) params.set("q", query);

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
