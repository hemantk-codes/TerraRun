// PHASE 3 — Territory Generation Engine
//
// Pure geometry functions (generateTerritoryGeometry and its three shape
// helpers) take a plain activity-shaped object and return a GeoJSON
// geometry — no DB/Express imports in that part, same "pure core, I/O at
// the edges" split as calorieEngine.js. Only generateTerritory (the last
// export) touches the DB, by creating the Territory document.
//
// Called from controllers/activityController.js right after a valid
// Activity is saved:
//   if (isValidForTerritory) {
//     const territory = await generateTerritory(activity, user);
//     activity.territoryId = territory._id;
//     await activity.save();
//   }

import * as turf from '@turf/turf';
import Territory from '../models/Territory.js';

// --- GAME-BALANCE constant — tune by playtesting, not physically derived ---
// sqm of territory awarded per kcal burnt. This is the single number that
// ties calorie effort to map footprint; Phase 8's decay-regrowth bonus
// reuses this exact constant so "1 kcal" means the same thing everywhere.
export const AREA_PER_CALORIE = 20;

// --- Loop-case constants ---
// turf.simplify's tolerance is in the same units as the geometry (degrees,
// since our coordinates are WGS84 lng/lat) and does a planar
// Douglas-Peucker pass — it doesn't correct for the fact that a degree of
// longitude shrinks with latitude. That's an acceptable approximation for
// running-route distances (a few km at most); expressing the tolerance in
// meters first and converting keeps the *intent* ("~5m of GPS jitter")
// legible even though the conversion itself is a rough equator-based one.
// Bump this up if real GPS traces still look spiky after simplification;
// drop it if loops start losing recognizable shape (see integration
// checklist in the phase prompt).
const SIMPLIFY_TOLERANCE_METERS = 5;
const DEG_PER_METER = 1 / 111320; // rough equirectangular conversion, fine at this scale
const LOOP_SIMPLIFY_TOLERANCE_DEG = SIMPLIFY_TOLERANCE_METERS * DEG_PER_METER;
// Guards against a degenerate/near-collinear "loop" (e.g. an out-and-back
// path that technically closes within 50m but encloses almost nothing)
// producing a divide-by-near-zero scale factor.
const MIN_NATURAL_LOOP_AREA_SQM = 1;

// --- Line-case constants ---
// Floor on the buffer half-width so a very-low-calorie (but >=1km, so still
// valid) walk doesn't produce a sub-meter, visually-invisible ribbon.
// Trades strict target-area accuracy for a territory that's actually
// visible on the map at the low end.
const LINE_MIN_WIDTH_METERS = 1;

// --- Random-case constants ---
const RANDOM_MIN_POINTS = 10;
const RANDOM_MAX_POINTS = 14; // inclusive, per spec ("~10-14 points")
const RANDOM_RADIUS_RATIO_MIN = 0.7;
const RANDOM_RADIUS_RATIO_SPREAD = 0.6; // ratio range is [0.7, 1.3]
const RANDOM_AREA_TOLERANCE = 0.05; // 5%, per spec
const RANDOM_MAX_RESCALE_ATTEMPTS = 5;

function toLngLatCoords(gpsPath) {
  return gpsPath.map((p) => [p.lng, p.lat]);
}

// Ensures a coordinate ring is closed (first position === last position),
// which turf.polygon() requires. GPS loops rarely close *exactly*, so we
// always append an explicit closing point rather than trusting the raw
// path — cheaper and more robust than a fuzzy "is it close enough" check.
function closeRing(coords) {
  const first = coords[0];
  const last = coords[coords.length - 1];
  if (first[0] === last[0] && first[1] === last[1]) {
    return coords;
  }
  return [...coords, first];
}

// --- Step 2: LOOP CASE ---
function generateLoopTerritory(gpsPath, targetAreaSqm) {
  const ring = closeRing(toLngLatCoords(gpsPath));
  if (ring.length < 4) {
    throw new Error('Loop path has too few distinct points to form a polygon.');
  }

  const rawPolygon = turf.polygon([ring]);
  // 2a: simplify first so GPS-jitter spikes don't get baked into the
  // captured shape before we measure/rescale it.
  const simplified = turf.simplify(rawPolygon, {
    tolerance: LOOP_SIMPLIFY_TOLERANCE_DEG,
    highQuality: true,
  });

  // 2b
  const naturalAreaSqm = turf.area(simplified);
  if (!Number.isFinite(naturalAreaSqm) || naturalAreaSqm < MIN_NATURAL_LOOP_AREA_SQM) {
    throw new Error('Loop polygon is degenerate (near-zero natural area) after simplification.');
  }

  // 2c
  const scaleFactor = Math.sqrt(targetAreaSqm / naturalAreaSqm);
  const scaled = turf.transformScale(simplified, scaleFactor, { origin: 'centroid' });

  return {
    geometry: scaled.geometry,
    areaSqm: turf.area(scaled),
    shapeType: 'loop',
  };
}

// --- Step 3: LINE CASE ---
function generateLineTerritory(gpsPath, targetAreaSqm, distanceKm) {
  const coords = toLngLatCoords(gpsPath);
  if (coords.length < 2) {
    throw new Error('Line path needs at least 2 points to buffer into a ribbon.');
  }

  // 3a — prefer the activity's own measured distance (matches what the
  // user's calories/Calons are based on) over re-deriving it from the raw
  // path here.
  const lineLengthM = distanceKm * 1000;
  if (!Number.isFinite(lineLengthM) || lineLengthM <= 0) {
    throw new Error('Line path has zero or invalid length.');
  }

  // 3b — this is a HALF-width (turf.buffer expands both sides of the
  // line), so total ribbon width ends up ~2*width and
  // area ~= lineLengthM * 2*width = targetAreaSqm, matching the spec.
  const rawWidth = targetAreaSqm / (2 * lineLengthM);
  const width = Math.max(rawWidth, LINE_MIN_WIDTH_METERS);

  // 3c
  const line = turf.lineString(coords);
  const buffered = turf.buffer(line, width, { units: 'meters' });

  return {
    geometry: buffered.geometry,
    areaSqm: turf.area(buffered),
    shapeType: 'line',
  };
}

// --- Step 4: RANDOM CASE ---
function generateRandomTerritory(gpsPath, targetAreaSqm) {
  const coords = toLngLatCoords(gpsPath);
  const centroid = turf.centroid(turf.lineString(coords));

  // 4b — pick the organic bump pattern ONCE (fixed angle count + per-point
  // radius ratios); the rescale loop below (4c) resizes this same shape
  // rather than re-rolling new randomness on every attempt.
  const numPoints =
    RANDOM_MIN_POINTS + Math.floor(Math.random() * (RANDOM_MAX_POINTS - RANDOM_MIN_POINTS + 1));
  const radiusRatios = Array.from(
    { length: numPoints },
    () => RANDOM_RADIUS_RATIO_MIN + Math.random() * RANDOM_RADIUS_RATIO_SPREAD
  );
  // area of a circle => r = sqrt(area / pi); used as the starting baseline
  // radius before the organic per-point perturbation is applied.
  const baseRadiusM = Math.sqrt(targetAreaSqm / Math.PI);

  function buildRing(radiusM) {
    const points = [];
    for (let i = 0; i < numPoints; i++) {
      const bearingDeg = (360 * i) / numPoints;
      const r = Math.max(radiusM * radiusRatios[i], 1); // guard against a ~0 radius
      const dest = turf.destination(centroid, r / 1000, bearingDeg, { units: 'kilometers' });
      points.push(dest.geometry.coordinates);
    }
    points.push(points[0]); // close the ring
    return turf.polygon([points]);
  }

  let polygon = buildRing(baseRadiusM);
  let areaSqm = turf.area(polygon);

  // 4c — iteratively rescale toward targetAreaSqm. transformScale keeps the
  // organic bumpy outline intact while resizing it uniformly; a couple of
  // passes are usually enough since area scales with the square of the
  // scale factor, but geographic (non-planar) coordinates mean one pass
  // isn't always exact, hence "iteratively".
  let attempts = 0;
  while (
    areaSqm > 0 &&
    Math.abs(areaSqm - targetAreaSqm) / targetAreaSqm > RANDOM_AREA_TOLERANCE &&
    attempts < RANDOM_MAX_RESCALE_ATTEMPTS
  ) {
    const scaleFactor = Math.sqrt(targetAreaSqm / areaSqm);
    polygon = turf.transformScale(polygon, scaleFactor, { origin: centroid.geometry.coordinates });
    areaSqm = turf.area(polygon);
    attempts += 1;
  }

  return {
    geometry: polygon.geometry,
    areaSqm,
    shapeType: 'random',
  };
}

/**
 * Pure function: given an activity-shaped object
 * ({ gpsPath, calories, isLoop, distanceKm }), returns
 * { geometry, areaSqm, shapeType } — no DB access. Takes a plain object
 * (or a Mongoose Activity document, whose fields are readable the same way)
 * so it's usable directly in tests/scripts without a live DB connection.
 */
export function generateTerritoryGeometry(activity) {
  const { gpsPath, calories, isLoop, distanceKm } = activity;

  if (!Array.isArray(gpsPath) || gpsPath.length < 2) {
    throw new Error('Activity has too few GPS points to generate a territory.');
  }

  // Step 1
  const targetAreaSqm = calories * AREA_PER_CALORIE;
  if (!Number.isFinite(targetAreaSqm) || targetAreaSqm <= 0) {
    throw new Error('Activity has no calories — cannot size a territory.');
  }

  if (isLoop) {
    return generateLoopTerritory(gpsPath, targetAreaSqm);
  }

  // Not a loop: distinguish a clean point-to-point route (LINE case, step 3)
  // from a self-intersecting/erratic one (RANDOM case, step 4) using
  // turf.kinks() on the raw path, per spec.
  const coords = toLngLatCoords(gpsPath);
  const line = turf.lineString(coords);
  const kinks = turf.kinks(line);
  const isSelfIntersecting = kinks.features.length > 0;

  if (isSelfIntersecting) {
    return generateRandomTerritory(gpsPath, targetAreaSqm);
  }

  return generateLineTerritory(gpsPath, targetAreaSqm, distanceKm);
}

/**
 * DB-touching wrapper: generates the geometry above, then creates and
 * returns the Territory document. Does NOT touch activity.territoryId or
 * save the activity — the caller (activityController.js) owns that, since
 * this function shouldn't need to know how its caller represents the
 * activity.
 *
 * Overlap with other users' existing territories is intentionally NOT
 * handled here — that's Phase 6 (invasion engine). This just creates the
 * territory in isolation, exactly as the Phase 3 spec asks.
 */
export async function generateTerritory(activity, user) {
  const { geometry, areaSqm, shapeType } = generateTerritoryGeometry(activity);

  return Territory.create({
    ownerId: user._id,
    geometry,
    color: user.preferredColor,
    areaSqm,
    shapeType,
    // Strength starts equal to areaSqm — this is the "health pool" a siege
    // (Phase 6/7) has to exceed before a weaker invader converts ownership.
    strength: areaSqm,
    // siegeDamage / lastReinforcedAt / decayState all use schema defaults.
  });
}
