// Phase 2 — pure geometry/stats helpers shared by the calorie engine.
// No Mongoose/Express imports here on purpose, so this stays trivially
// unit-testable and reusable by Phase 3's territory generation later.

const EARTH_RADIUS_M = 6371000;

export function toRadians(deg) {
  return (deg * Math.PI) / 180;
}

export function haversineDistanceMeters(lat1, lng1, lat2, lng2) {
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_M * c;
}

// Centered moving average (averages each value with up to `window/2`
// neighbors on either side, fewer at the array edges). Used only to smooth
// per-segment speed for vehicle-mode detection (Phase 2, calorieEngine.js
// step "activityType") — raw per-segment speed is still used for the
// calorie calculation itself, since smoothing there would blur real pace
// changes (e.g. hills) that the ACSM formula needs to see.
export function movingAverage(values, window = 5) {
  const half = Math.floor(window / 2);
  return values.map((_, i) => {
    const start = Math.max(0, i - half);
    const end = Math.min(values.length, i + half + 1);
    const slice = values.slice(start, end);
    return slice.reduce((sum, v) => sum + v, 0) / slice.length;
  });
}

export function mean(values) {
  if (!values.length) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

export function stdDev(values) {
  if (!values.length) return 0;
  const m = mean(values);
  const variance = mean(values.map((v) => (v - m) ** 2));
  return Math.sqrt(variance);
}
