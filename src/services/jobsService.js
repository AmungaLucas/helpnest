import { apiRequest } from "../config/api";

// ---------------------------------------------------------------------------
// Employer — posting + managing listings
// ---------------------------------------------------------------------------

// Publish a job. The server enforces the PRD §13.4 gate itself: a response
// with error.status === 402 means "no post credit and no plan" — the app
// then opens the payment sheet (JobPostModal) and retries the SAME payload
// after payment (the held payload auto-publishes on focus).
export function createJob(payload) {
  return apiRequest("/api/jobs", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// The caller's own posts, newest first — each with applicationsCount and
// the 30-day publication window (expiresAt).
export function listMyJobs() {
  return apiRequest("/api/jobs/mine");
}

// Currently supports closing ('closed') and reopening ('open') a post.
// Reopening inside the 30-day window is free; after expiry the server
// answers 409 and the listing needs a new post credit (PRD §11.2).
export function setJobStatus(jobId, status) {
  return apiRequest(`/api/jobs/${jobId}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

// Applicants for one of the caller's jobs. Opening this list marks fresh
// submissions as viewed (PRD §12.1) — viewing never consumes anything.
export function listJobApplications(jobId) {
  return apiRequest(`/api/jobs/${jobId}/applications`);
}

// ---------------------------------------------------------------------------
// Maid — feed + applications (PRD §6 / §12 / §13.2)
// ---------------------------------------------------------------------------

// Published, unexpired job listings. Optional category filter + pagination.
export function listJobFeed({ category, offset = 0, limit = 30 } = {}) {
  const params = new URLSearchParams();

  if (category) params.set("category", category);
  params.set("offset", String(offset));
  params.set("limit", String(limit));

  const qs = params.toString();

  return apiRequest(`/api/jobs/feed${qs ? `?${qs}` : ""}`);
}

// One listing with its full description (feed rows carry a trimmed shape).
export function getJob(jobId) {
  return apiRequest(`/api/jobs/${jobId}`);
}

// Apply to a job. Consumes one application entitlement server-side (PRD
// §13.2); a 402 means the maid is out of credits/plans and the app opens
// ApplyAccessModal — the intent is retried automatically after payment.
export function applyToJob(jobId) {
  return apiRequest(`/api/jobs/${jobId}/apply`, { method: "POST" });
}

// The caller's applications with job + employer context, newest first.
export function listMyApplications() {
  return apiRequest("/api/applications/mine");
}

// Employer: shortlisted | accepted | rejected. Maid: withdrawn.
export function setApplicationStatus(applicationId, status) {
  return apiRequest(`/api/applications/${applicationId}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}
