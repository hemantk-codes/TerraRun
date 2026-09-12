// PHASE 7 — Invasion Engine v2 (Split Detection & Reclaim Flow)
// PHASE 10 UPDATE — the bare `Notification.create(...)` this file used to
// build for `territory_split` now goes through notify() instead, so it
// also pushes a live Socket.io toast to the victim, not just a silent DB
// row. (All other DESIGN DECISIONS notes below are unchanged from Phase 7.)
//
// ============================================================================
// DESIGN DECISIONS / ASSUMPTIONS — read this before touching resolve-split
// in territoryController.js:
//
// 1. SCOPE: only runs when the activity is !isLoop AND isValidForTerritory.
// 2. FRAGMENT OWNERSHIP: the orphaned fragment is saved as a real Territory
//    doc owned by the INVADER the instant the cut happens.
// 3. CALONS: no calonsTotal/Weekly/Monthly deduction happens on the victim
//    for the lost area, to stay consistent with invasionEngine.js's own
//    "Calons never decreases on loss" invariant.
// 4. INTERSECTION-COUNT TOLERANCE: a small dedupe pass merges near-duplicate
//    GPS-jitter crossings before the "exactly 2 intersections" check.
// ============================================================================

import * as turf from '@turf/turf';
import User from '../models/User.js';
import Territory from '../models/Territory.js';
import { notify } from './notificationService.js'; // Phase 10

const BLADE_BUFFER_METERS = 8;
const SIGNIFICANT_PIECE_RATIO = 0.01;
const INTERSECTION_DEDUPE_METERS = 5;

function toGeoJSON(geom) {
  return typeof geom?.toObject === 'function' ? geom.toObject() : geom;
}

function dedupeNearbyPoints(points, thresholdMeters) {
  const kept = [];
  for (const p of points) {
    const isDuplicate = kept.some((k) => turf.distance(k, p, { units: 'meters' }) < thresholdMeters);
    if (!isDuplicate) kept.push(p);
  }
  return kept;
}

function extractSignificantPieces(differenceResult, originalAreaSqm) {
  if (!differenceResult) return [];
  const flattened = turf.flatten(differenceResult);
  const minAreaSqm = originalAreaSqm * SIGNIFICANT_PIECE_RATIO;
  return flattened.features
    .map((f) => ({ feature: f, areaSqm: turf.area(f) }))
    .filter((p) => p.areaSqm >= minAreaSqm)
    .sort((a, b) => b.areaSqm - a.areaSqm);
}

function unionAll(pieces) {
  if (pieces.length === 1) return pieces[0].feature;
  const collection = turf.featureCollection(pieces.map((p) => p.feature));
  const unioned = turf.union(collection);
  return unioned || pieces[0].feature;
}

function attemptCut(defenderTerritory, bladeFeature) {
  const defenderFeature = turf.feature(toGeoJSON(defenderTerritory.geometry));
  const originalAreaSqm = defenderTerritory.areaSqm;

  let differenceResult;
  try {
    differenceResult = turf.difference(turf.featureCollection([defenderFeature, bladeFeature]));
  } catch (err) {
    console.error(
      `[splitEngine] turf.difference failed for territory ${defenderTerritory._id.toString()}:`,
      err
    );
    return null;
  }

  if (!differenceResult) return null;

  const pieces = extractSignificantPieces(differenceResult, originalAreaSqm);
  if (pieces.length < 2) return null;

  const [largest, ...rest] = pieces;
  const fragmentFeature = unionAll(rest);
  const fragmentAreaSqm = turf.area(fragmentFeature);
  const remainderAreaSqm = largest.areaSqm;

  return {
    remainderGeometry: largest.feature.geometry,
    remainderAreaSqm,
    fragmentGeometry: fragmentFeature.geometry,
    fragmentAreaSqm,
    areaLostSqm: Math.max(0, originalAreaSqm - remainderAreaSqm),
  };
}

/**
 * Entry point — call after saving a non-loop, isValidForTerritory Activity:
 *
 *   if (!activity.isLoop && isValidForTerritory) {
 *     await resolveSplits(activity, user);
 *   }
 */
export async function resolveSplits(activity, invaderUser) {
  const { gpsPath } = activity;
  if (!Array.isArray(gpsPath) || gpsPath.length < 2) return;

  const pathCoords = gpsPath.map((p) => [p.lng, p.lat]);
  const pathLine = turf.lineString(pathCoords);
  const bladeFeature = turf.buffer(pathLine, BLADE_BUFFER_METERS, { units: 'meters' });

  const candidates = await Territory.find({
    ownerId: { $ne: invaderUser._id },
    geometry: { $geoIntersects: { $geometry: pathLine.geometry } },
  });

  for (const defenderTerritory of candidates) {
    try {
      await trySliceOne({ pathLine, bladeFeature, defenderTerritory, invaderUser });
    } catch (err) {
      console.error(
        `[splitEngine] Failed to resolve split against territory ${defenderTerritory._id.toString()}:`,
        err
      );
    }
  }
}

async function trySliceOne({ pathLine, bladeFeature, defenderTerritory, invaderUser }) {
  // Already mid-decision from an earlier slice this territory hasn't
  // resolved yet — don't stack a second pending split on top of the first.
  if (defenderTerritory.pendingSplit) return;

  // Step 1 — DETECTION
  const boundaryLine = turf.polygonToLine(turf.feature(toGeoJSON(defenderTerritory.geometry)));
  const rawIntersections = turf.lineIntersect(pathLine, boundaryLine);
  const dedupedPoints = dedupeNearbyPoints(
    rawIntersections.features.map((f) => f.geometry.coordinates),
    INTERSECTION_DEDUPE_METERS
  );
  if (dedupedPoints.length !== 2) return; // not a clean pierce-through — skip

  // Step 2 — PERFORM THE CUT
  const cut = attemptCut(defenderTerritory, bladeFeature);
  if (!cut) return; // geometrically didn't separate into 2+ real pieces

  const victimUser = await User.findById(defenderTerritory.ownerId);
  if (!victimUser) return; // orphaned territory, no owner to notify

  // Step 3 — victim keeps the larger piece
  defenderTerritory.geometry = cut.remainderGeometry;
  defenderTerritory.areaSqm = cut.remainderAreaSqm;
  // strength deliberately untouched — same precedent as Phase 6's partial
  // captures.

  // The orphaned fragment — saved as its own Territory, owned by the
  // INVADER from the moment of the cut (see DESIGN DECISIONS #2).
  const fragmentTerritory = await Territory.create({
    ownerId: invaderUser._id,
    geometry: cut.fragmentGeometry,
    color: invaderUser.preferredColor,
    areaSqm: cut.fragmentAreaSqm,
    shapeType: 'random', // irregular leftover shape — reuses the existing enum value
    strength: cut.fragmentAreaSqm,
  });

  // PHASE 10 — notify() persists AND pushes the live toast in one call.
  const notification = await notify(victimUser._id, 'territory_split', {
    territoryId: defenderTerritory._id.toString(),
    fragmentTerritoryId: fragmentTerritory._id.toString(),
    fragmentAreaSqm: cut.fragmentAreaSqm,
    areaLostSqm: cut.areaLostSqm,
    invaderId: invaderUser._id.toString(),
    invaderName: invaderUser.name,
    resolved: false,
  });

  defenderTerritory.pendingSplit = {
    fragmentTerritoryId: fragmentTerritory._id,
    fragmentAreaSqm: cut.fragmentAreaSqm,
    invaderId: invaderUser._id,
    invaderName: invaderUser.name,
    areaLostSqm: cut.areaLostSqm,
    notificationId: notification._id,
    createdAt: new Date(),
  };

  await defenderTerritory.save();
}
