// PHASE 2 — Activity Recording & Calorie Engine
//
// Pure functions: no DB/Express imports, so this is trivially testable and
// reusable (Phase 8's decay/streak comparisons will call
// computeActivityMetrics-shaped numbers again, and Phase 3 consumes
// `calories` directly). All I/O (fetching the User, saving the Activity)
// lives in controllers/activityController.js, not here.
//
// Sanity-checked against synthetic fixtures before shipping this: a 4.99km
// loop at running pace for a 70kg user comes out to ~384 kcal, which lands
// in the expected 250-450 kcal band for a 5km run.

import { haversineDistanceMeters, movingAverage, mean, stdDev } from './geo.js';

// --- ACSM metabolic equation constants (spec'd exactly, not tunable) ---
// Pace cutoff between the ACSM walking and running VO2 formulas. Also used
// as the majority-of-duration threshold that decides the overall
// activityType ('walk' vs 'run'), so that field stays consistent with what
// the calorie math actually used per segment.
export const WALK_RUN_THRESHOLD_KMH = 6.4;
// ACSM resting VO2 baseline (mL/kg/min). Floors any segment's VO2 so a
// fast-downhill (very negative grade) segment can't produce negative
// calories.
export const VO2_FLOOR = 3.5;

// --- GAME-BALANCE / HEURISTIC constants — tune by playtesting, not physically derived ---
// Vehicle-mode detection (Phase 2 spec point e). "Sustained majority of
// segments (>60% of total duration) show speed > 20 km/h with low
// variance" — this is a coarse heuristic (a bus in heavy traffic or a very
// fast cyclist can trip it or dodge it); true sensor-based mode detection
// (accelerometer, motion API) is flagged in the code below as good
// "future work" for the mobile app version.
export const VEHICLE_SPEED_THRESHOLD_KMH = 20;
export const VEHICLE_DURATION_FRACTION = 0.6;
// "Low variance" isn't defined numerically in the spec — implemented here
// as coefficient of variation (stdev/mean) of raw speeds in a local window
// around each point, so one GPS jitter spike doesn't itself count as
// "steady". 0.25 was chosen so a smoothly cruising car (speed varies a
// little with traffic) passes, but a runner whose raw per-segment speed
// swings wildly from GPS noise does not.
export const VEHICLE_VARIANCE_COEFF_THRESHOLD = 0.25;
// Window size (in GPS points) for both the vehicle-detection smoothing and
// the local variance check. Spec said "~5 points".
export const SPEED_SMOOTHING_WINDOW = 5;

// --- Territory-eligibility thresholds (spec points x/xi) ---
export const MIN_DISTANCE_KM_FOR_TERRITORY = 1;
export const LOOP_CLOSURE_METERS = 50;
export const LOOP_MIN_DISTANCE_KM = 0.3;

function vo2ForSegment(speedMPerMin, grade, isWalking) {
  const vo2 = isWalking
    ? 0.1 * speedMPerMin + 1.8 * speedMPerMin * grade + 3.5
    : 0.2 * speedMPerMin + 0.9 * speedMPerMin * grade + 3.5;
  return Math.max(vo2, VO2_FLOOR);
}

// Turns a raw gpsPath array into per-segment metrics between consecutive
// points. Guards two real-world GPS edge cases: duplicate/out-of-order
// timestamps (timeSec <= 0) and the device sitting still (distanceM = 0) —
// both are treated as a zero-speed/zero-grade "resting" segment rather than
// dividing by zero or producing Infinity/NaN.
export function buildSegments(gpsPath) {
  const segments = [];
  for (let i = 1; i < gpsPath.length; i++) {
    const prev = gpsPath[i - 1];
    const curr = gpsPath[i];

    const distanceM = haversineDistanceMeters(prev.lat, prev.lng, curr.lat, curr.lng);
    const timeSec = (new Date(curr.t).getTime() - new Date(prev.t).getTime()) / 1000;
    const timeMin = timeSec > 0 ? timeSec / 60 : 0;
    const eleDeltaM = (curr.ele ?? 0) - (prev.ele ?? 0);

    const speedMPerMin = timeMin > 0 ? distanceM / timeMin : 0;
    const speedKmh = timeMin > 0 ? (distanceM / 1000) / (timeMin / 60) : 0;
    const grade = distanceM > 0 ? eleDeltaM / distanceM : 0;

    segments.push({ distanceM, timeSec: Math.max(timeSec, 0), timeMin, eleDeltaM, grade, speedMPerMin, speedKmh });
  }
  return segments;
}

/**
 * Computes distance, elevation gain, duration, calories, activityType, and
 * isLoop from a raw GPS path. Pure — takes bodyWeightKg as a parameter
 * rather than fetching the User itself, so the controller stays in charge
 * of I/O and this stays unit-testable.
 *
 * ASSUMPTION: the `weight` fallback (70kg) below only fires if this is
 * called with a falsy bodyWeightKg. In practice activityController.js
 * rejects the request before calling this if the user's profile has no
 * bodyWeightKg set, so a real Activity should never actually hit the
 * fallback — it's here so this function never throws/NaNs if called
 * directly (e.g. from a future script or test) without that guard.
 */
export function computeActivityMetrics(gpsPath, bodyWeightKg) {
  if (!Array.isArray(gpsPath) || gpsPath.length < 2) {
    return { distanceKm: 0, elevationGainM: 0, durationSec: 0, calories: 0, activityType: 'unknown', isLoop: false };
  }

  const segments = buildSegments(gpsPath);

  const distanceM = segments.reduce((sum, s) => sum + s.distanceM, 0);
  const distanceKm = distanceM / 1000;
  const elevationGainM = segments.reduce((sum, s) => sum + Math.max(s.eleDeltaM, 0), 0);
  const durationSec = Math.max(
    0,
    (new Date(gpsPath[gpsPath.length - 1].t).getTime() - new Date(gpsPath[0].t).getTime()) / 1000
  );

  const weight = bodyWeightKg && bodyWeightKg > 0 ? bodyWeightKg : 70;
  // --- Calories: ACSM equation, computed PER SEGMENT and summed (spec point d) ---
  let calories = 0;
  for (const seg of segments) {
    const isWalking = seg.speedKmh < WALK_RUN_THRESHOLD_KMH;
    const vo2 = vo2ForSegment(seg.speedMPerMin, seg.grade, isWalking);
    calories += ((vo2 * weight) / 200) * seg.timeMin;
  }

  // --- activityType: vehicle detection via smoothed speed + local variance (spec point e) ---
  const rawSpeeds = segments.map((s) => s.speedKmh);
  const smoothedSpeeds = movingAverage(rawSpeeds, SPEED_SMOOTHING_WINDOW);

  let vehicleTimeSec = 0;
  smoothedSpeeds.forEach((smoothedSpeed, i) => {
    if (smoothedSpeed <= VEHICLE_SPEED_THRESHOLD_KMH) return;
    const half = Math.floor(SPEED_SMOOTHING_WINDOW / 2);
    const start = Math.max(0, i - half);
    const end = Math.min(rawSpeeds.length, i + half + 1);
    const windowSpeeds = rawSpeeds.slice(start, end);
    const windowMean = mean(windowSpeeds);
    const coeffOfVariation = windowMean > 0 ? stdDev(windowSpeeds) / windowMean : 0;
    if (coeffOfVariation <= VEHICLE_VARIANCE_COEFF_THRESHOLD) {
      vehicleTimeSec += segments[i].timeSec;
    }
  });

  const totalTimeSec = segments.reduce((sum, s) => sum + s.timeSec, 0);
  const vehicleFraction = totalTimeSec > 0 ? vehicleTimeSec / totalTimeSec : 0;

  let activityType;
  if (vehicleFraction > VEHICLE_DURATION_FRACTION) {
    activityType = 'vehicle';
  } else {
    const runTimeSec = segments
      .filter((s) => s.speedKmh >= WALK_RUN_THRESHOLD_KMH)
      .reduce((sum, s) => sum + s.timeSec, 0);
    activityType = runTimeSec > totalTimeSec / 2 ? 'run' : 'walk';
  }

  // --- isLoop (spec point f) ---
  const first = gpsPath[0];
  const last = gpsPath[gpsPath.length - 1];
  const closureDistanceM = haversineDistanceMeters(first.lat, first.lng, last.lat, last.lng);
  const isLoop = closureDistanceM < LOOP_CLOSURE_METERS && distanceKm >= LOOP_MIN_DISTANCE_KM;

  return {
    distanceKm,
    elevationGainM,
    durationSec,
    calories: Math.max(calories, 0),
    activityType,
    isLoop,
  };
}
