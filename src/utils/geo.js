// Shared geo helpers — distance formatting + client-side Haversine.
//
// The SERVER is the source of truth for worker distances (its Haversine
// never exposes a worker's raw coords to clients). This module is for
// display formatting shared across screens, and for the rare client-side
// calc where both points are already known to the app (e.g. the user's own
// saved coords vs coords the user typed).

// 350 m -> "350 m", 2.4 -> "2.4 km", 38 -> "38 km".
export function formatDistance(km) {
  if (km === null || km === undefined || !Number.isFinite(km)) return null;
  if (km < 1) return `${Math.max(1, Math.round(km * 1000))} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

// Haversine between two { latitude, longitude }-style points, in km.
export function haversineKm(lat1, lng1, lat2, lng2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const a =
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.cos(toRad(lng2) - toRad(lng1)) +
    Math.sin(toRad(lat1)) * Math.sin(toRad(lat2));
  return 6371 * Math.acos(Math.min(1, Math.max(-1, a)));
}
