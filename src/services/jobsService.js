import { apiRequest } from "../config/api";

// Job posts (employer). The server enforces the KES 500 posting fee itself:
// a createJob() call that comes back with error.status === 402 means "no
// active subscription and no unused post credit" — the app then opens the
// payment sheet (JobPostModal) and retries the SAME payload after payment.
export function createJob(payload) {
  return apiRequest("/api/jobs", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// The caller's own posts, newest first.
export function listMyJobs() {
  return apiRequest("/api/jobs/mine");
}

// Currently supports closing ('closed') and reopening ('open') a post.
export function setJobStatus(jobId, status) {
  return apiRequest(`/api/jobs/${jobId}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}
