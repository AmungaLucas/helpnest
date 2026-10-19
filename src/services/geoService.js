import { apiRequest } from "../config/api";

// Reverse geocoding through the gateway proxy (Nominatim + 12h cache).
// Returns a coarse area label like "Kilimani, Nairobi", or null when the
// provider is unavailable — callers must treat null as "keep what we have",
// never as an error.
export async function reverseGeocode(lat, lng) {
  try {
    const data = await apiRequest(
      `/api/geo/reverse?lat=${Number(lat).toFixed(6)}&lng=${Number(lng).toFixed(6)}`
    );
    return data?.label || null;
  } catch (error) {
    if (__DEV__) {
      console.log("[GEO] reverse geocode failed:", error?.message || error);
    }
    return null;
  }
}
