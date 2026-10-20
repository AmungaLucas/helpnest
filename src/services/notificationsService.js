import { apiRequest } from "../config/api";

// Notifications (PRD §17) — the in-app feed. Email fan-out happens
// server-side; this is the read/mark surface.

// -> { success, unread, notifications: [{ id, kind, title, body, data, read, createdAt }] }
export function fetchNotifications() {
  return apiRequest("/api/notifications");
}

// -> { success }
export function markNotificationRead(id) {
  return apiRequest(`/api/notifications/${id}/read`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

// -> { success }
export function markAllNotificationsRead() {
  return apiRequest("/api/notifications/read-all", {
    method: "POST",
    body: JSON.stringify({}),
  });
}
