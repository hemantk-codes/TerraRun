// PHASE 6 — Invasion Engine v1 (Full Overwrite on Loop Capture)
// PHASE 10 UPDATE — both notifications this file used to build with a bare
// `Notification.create(...)` (territory_invaded, territory_under_siege)
// now go through notify() instead, so they also push a live Socket.io
// toast, not just a silent DB row. The "TODO(Phase 10): also notify the
// INVADER" from the Phase 6 version is now implemented as
// invasion_succeeded, right below the victim's territory_invaded call.
//
// (Rest of the file's original header comments — known limitations around
// siege-overlap visuals and non-transactional writes — are unchanged from
// Phase 6 and still apply.)

import * as turf from '@turf/turf';
import User from '../models/User.js';
import Territory from '../models/Territory.js';
import { notify } from './notificationService.js'; // Phase 10
import { awardCalonsForAreaGain } from './calonsEngine.js';

// --- Tunables ---
const MIN_SIGNIFICANT_OVERLAP_SQM = 1;
const MIN_REMAINDER_AREA_SQM = 1;

function toGeoJSON(geom) {
  return typeof geom?.toObject === 'function' ? geom.toObject() : geom;
}

/**
 * Entry point — passed to generateTerritory() as `onBeforeSave`.
 */
export async function resolveInvasions(territory, invaderUser) {
  if (territory.shapeType !== 'loop') {
    return; // Phase 6 only checks loop captures — see file header.
  }

  const invaderGeoJSON = toGeoJSON(territory.geometry);
  const invaderFeature = turf.feature(invaderGeoJSON);

  const candidates = await Territory.find({
    ownerId: { $ne: invaderUser._id },
    geometry: { $geoIntersects: { $geometry: invaderGeoJSON } },
  });

  if (candidates.length === 0) {
    territory.$locals.calonsEarned = await awardCalonsForAreaGain(invaderUser._id, territory.areaSqm);
    return;
  }

  let unclaimedAreaSqm;
  try {
    const defenderFeatures = candidates.map((t) => turf.feature(toGeoJSON(t.geometry)));
    const unclaimed = turf.difference(turf.featureCollection([invaderFeature, ...defenderFeatures]));
    unclaimedAreaSqm = unclaimed ? turf.area(unclaimed) : 0;
  } catch (err) {
    console.error('[invasionEngine] Failed to compute unclaimed area, skipping invasion resolution:', err);
    territory.$locals.calonsEarned = await awardCalonsForAreaGain(invaderUser._id, territory.areaSqm);
    return;
  }

  let totalCalonsEarned = await awardCalonsForAreaGain(invaderUser._id, unclaimedAreaSqm);

  // Single snapshot of the invader's Calons total for every comparison in
  // this event.
  const invaderCalonsSnapshot = invaderUser.calonsTotal;

  for (const defenderTerritory of candidates) {
    try {
      const defenderFeature = turf.feature(toGeoJSON(defenderTerritory.geometry));
      const overlap = turf.intersect(turf.featureCollection([invaderFeature, defenderFeature]));
      if (!overlap) continue;

      const overlapAreaSqm = turf.area(overlap);
      if (overlapAreaSqm < MIN_SIGNIFICANT_OVERLAP_SQM) continue;

      const defenderUser = await User.findById(defenderTerritory.ownerId);
      if (!defenderUser) continue;

      const captured =
        invaderCalonsSnapshot >= defenderUser.calonsTotal
          ? await transferOverlap({ invaderFeature, defenderTerritory, defenderUser, invaderUser, overlapAreaSqm })
          : await applySiegeDamage({ invaderFeature, defenderTerritory, defenderUser, invaderUser, overlapAreaSqm });

      totalCalonsEarned += captured;
    } catch (err) {
      console.error(
        `[invasionEngine] Failed to resolve overlap against territory ${defenderTerritory._id.toString()}:`,
        err
      );
    }
  }

  territory.$locals.calonsEarned = totalCalonsEarned;
}

/**
 * Full transfer of `overlapAreaSqm` worth of ground from defender to
 * invader.
 */
async function transferOverlap({ invaderFeature, defenderTerritory, defenderUser, invaderUser, overlapAreaSqm, resetSiegeKey }) {
  const defenderFeature = turf.feature(toGeoJSON(defenderTerritory.geometry));
  const remainder = turf.difference(turf.featureCollection([defenderFeature, invaderFeature]));
  const remainderAreaSqm = remainder ? turf.area(remainder) : 0;
  const fullyConsumed = !remainder || remainderAreaSqm < MIN_REMAINDER_AREA_SQM;

  if (fullyConsumed) {
    await Territory.deleteOne({ _id: defenderTerritory._id });
  } else {
    defenderTerritory.geometry = remainder.geometry;
    defenderTerritory.areaSqm = remainderAreaSqm;
    if (resetSiegeKey) {
      defenderTerritory.siegeDamage.set(resetSiegeKey, 0);
    }
    await defenderTerritory.save();
  }

  await notify(defenderUser._id, 'territory_invaded', {
    territoryId: defenderTerritory._id.toString(),
    invaderId: invaderUser._id.toString(),
    invaderName: invaderUser.name,
    areaLostSqm: overlapAreaSqm,
    fullyConsumed,
    remainingAreaSqm: fullyConsumed ? 0 : remainderAreaSqm,
  });

  // PHASE 10 — confirmation to the attacker, implementing the Phase 6 TODO.
  await notify(invaderUser._id, 'invasion_succeeded', {
    territoryId: defenderTerritory._id.toString(),
    defenderId: defenderUser._id.toString(),
    defenderName: defenderUser.name,
    areaGainedSqm: overlapAreaSqm,
    fullyConsumed,
  });

  return awardCalonsForAreaGain(invaderUser._id, overlapAreaSqm);
}

/**
 * Siege branch — invader has fewer Calons than the defender.
 */
async function applySiegeDamage({ invaderFeature, defenderTerritory, defenderUser, invaderUser, overlapAreaSqm }) {
  const key = invaderUser._id.toString();
  const existingDamage = defenderTerritory.siegeDamage.get(key) || 0;
  const damageDelta = overlapAreaSqm * (invaderUser.calonsTotal / defenderUser.calonsTotal);
  const newDamage = existingDamage + damageDelta;

  if (newDamage >= defenderTerritory.strength) {
    return transferOverlap({
      invaderFeature,
      defenderTerritory,
      defenderUser,
      invaderUser,
      overlapAreaSqm,
      resetSiegeKey: key,
    });
  }

  defenderTerritory.siegeDamage.set(key, newDamage);
  await defenderTerritory.save();

  await notify(defenderUser._id, 'territory_under_siege', {
    territoryId: defenderTerritory._id.toString(),
    invaderId: invaderUser._id.toString(),
    invaderName: invaderUser.name,
    siegeDamage: newDamage,
    strength: defenderTerritory.strength,
  });

  return 0; // no ownership change yet, so no Calons this event
}
