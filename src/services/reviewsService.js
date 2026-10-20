import { apiRequest } from "../config/api";

// Ratings & reviews (v1.0 §9) — hire confirmation + double-blind reviews
// tied to a conversation.

// -> { success, bothConfirmed, disputed }
export function confirmHire(conversationId, confirm) {
  return apiRequest(`/api/reviews/${conversationId}/hire`, {
    method: "POST",
    body: JSON.stringify({ confirm }),
  });
}

// -> { success, hireConfirmed, bothConfirmed, disputed, myReviewSubmitted }
export function getHireState(conversationId) {
  return apiRequest(`/api/reviews/${conversationId}/hire`);
}

// -> { success, reviewId }
export function submitReview(conversationId, rating, comment) {
  return apiRequest(`/api/reviews/${conversationId}`, {
    method: "POST",
    body: JSON.stringify({ rating, ...(comment ? { comment } : {}) }),
  });
}

// -> { success, ratingAvg, ratingCount, reviews }
export function reviewsForUser(userId) {
  return apiRequest(`/api/reviews/user/${userId}`);
}

// -> { success, hireConfirmedConversations, given, ratingAvg, ratingCount, reviews }
export function myReviews() {
  return apiRequest("/api/reviews/mine");
}

// -> { success }
export function respondToReview(reviewId, text) {
  return apiRequest(`/api/reviews/${reviewId}/response`, {
    method: "POST",
    body: JSON.stringify({ text }),
  });
}
