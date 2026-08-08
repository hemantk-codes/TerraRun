// PHASE 6 — Invasion Engine v1 (Full Overwrite on Loop Capture)
//
// Hooked into territory creation via the `onBeforeSave` callback that
// utils/territoryEngine.js's generateTerritory() now accepts (see that
// file's diff) — this runs AFTER the new territory's geometry/areaSqm are
// computed but BEFORE the document is persisted, exactly as the phase
// prompt specifies ("before final save").
//
// Deliberately scoped to LOOP territories only, per the phase prompt
// ("When a new loop territory is generated..."). Line/random territories
// pass straight through untouched — Phase 7 is where a non-loop path that
// slices through enemy territory gets handled (a different mechanic:
// splitting, not full/partial capture).
//
// ⚠️ KNOWN LIMITATION (intentional, per "ship this simple version first"):
// when a weaker invader's loop only manages to SIEGE (not capture) an
// overlapping enemy territory, that enemy territory is left completely
// unchanged — including the ground the invader's new loop physically
// covers. The map can therefore briefly show two territories claiming the
// same patch until the siege eventually succeeds (or the invader gives
// up). Nothing in the Phase 6 spec asks this v1 to prevent that visual
// overlap; flagging it here so it isn't mistaken for a bug later.
//
// ⚠️ KNOWN LIMITATION (concurrency): this does plain sequential
// reads/writes, not a Mongo multi-document transaction. Your README has
// people running a standalone local `mongod`, which doesn't support
// transactions (only replica sets do) — matching every other multi-step
// write already in this codebase (e.g. activityController.js's
// Activity-then-Territory sequence), this stays non-transactional and
// documents the gap rather than silently assuming a replica-set-only
// feature works in local dev. Worth revisiting before any real deploy
// where two invasions could race.

import * as turf from '@turf/turf';
import User from '../models/User.js';
import Territory from '../models/Territory.js';
import Notification from '../models/Notification.js';
import { awardCalonsForAreaGain } from './calonsEngine.js';

// --- Tunables ---
// Ignore overlaps/remainders below this area — guards against turf
// returning razor-thin floating-point slivers from geometries that are
// really just touching at an edge, not meaningfully overlapping. Same
// "floor near-zero geometry noise" pattern as MIN_NATURAL_LOOP_AREA_SQM in
// territoryEngine.js.
const MIN_SIGNIFICANT_OVERLAP_SQM = 1;
const MIN_REMAINDER_AREA_SQM = 1;

function toGeoJSON(geom) {
  return typeof geom?.toObject === 'function' ? geom.toObject() : geom;
}

/**
 * Entry point — passed to generateTerritory() as `onBeforeSave`.
 *
 * `territory` is an unsaved `new Territory({...})` instance at this point;
 * generateTerritory() calls `.save()` right after this function returns.
 * This function mutates nothing on it except (for loop territories that
 * actually get resolved) stashing the total Calons earned this event on
 * `territory.$locals.calonsEarned` — a Mongoose-provided scratch space for
 * exactly this kind of transient, non-schema bookkeeping — so
 * activityController.js knows to use that total instead of separately
 * awarding for the full final areaSqm (see that file's diff for why doing
 * both would double-count).
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
    // The overwhelmingly common case (no enemy overlap at all) — the whole
    // new territory is virgin ground, identical to pre-Phase-6 behavior.
    territory.$locals.calonsEarned = await awardCalonsForAreaGain(invaderUser._id, territory.areaSqm);
    return;
  }

  // "Unclaimed" portion of the new territory = N minus every candidate
  // enemy territory it overlaps — whether that overlap ends up captured,
  // sieged, or filtered out below as insignificant, that ground isn't
  // newly-claimed-from-nothing, so it shouldn't earn the flat Phase 5
  // "whole new area" award. Only actually-captured ground earns Calons,
  // via transferOverlap() below.
  let unclaimedAreaSqm;
  try {
    const defenderFeatures = candidates.map((t) => turf.feature(toGeoJSON(t.geometry)));
    const unclaimed = turf.difference(turf.featureCollection([invaderFeature, ...defenderFeatures]));
    unclaimedAreaSqm = unclaimed ? turf.area(unclaimed) : 0;
  } catch (err) {
    // A malformed candidate geometry shouldn't cost the invader their
    // deserved Calons over a library hiccup — fall back to the old
    // Phase 5 "whole area" award and skip invasion resolution entirely for
    // this request rather than half-apply it against data we can't trust.
    console.error('[invasionEngine] Failed to compute unclaimed area, skipping invasion resolution:', err);
    territory.$locals.calonsEarned = await awardCalonsForAreaGain(invaderUser._id, territory.areaSqm);
    return;
  }

  let totalCalonsEarned = await awardCalonsForAreaGain(invaderUser._id, unclaimedAreaSqm);

  // Single snapshot of the invader's Calons total for every comparison in
  // this event, even though a capture below awards the invader more
  // Calons mid-loop. Using a live-updating total would make the outcome
  // depend on which defender happens to get processed first — this stays
  // simple and deterministic instead.
  const invaderCalonsSnapshot = invaderUser.calonsTotal;

  for (const defenderTerritory of candidates) {
    try {
      const defenderFeature = turf.feature(toGeoJSON(defenderTerritory.geometry));
      const overlap = turf.intersect(turf.featureCollection([invaderFeature, defenderFeature]));
      if (!overlap) continue; // bbox-level candidate, no actual geometric overlap

      const overlapAreaSqm = turf.area(overlap);
      if (overlapAreaSqm < MIN_SIGNIFICANT_OVERLAP_SQM) continue;

      const defenderUser = await User.findById(defenderTerritory.ownerId);
      if (!defenderUser) continue; // orphaned territory — no owner to resolve against

      const captured =
        invaderCalonsSnapshot >= defenderUser.calonsTotal
          ? await transferOverlap({ invaderFeature, defenderTerritory, defenderUser, invaderUser, overlapAreaSqm })
          : await applySiegeDamage({ invaderFeature, defenderTerritory, defenderUser, invaderUser, overlapAreaSqm });

      totalCalonsEarned += captured;
    } catch (err) {
      // One bad candidate geometry shouldn't sink the whole invasion
      // event — log it and keep resolving the rest.
      console.error(
        `[invasionEngine] Failed to resolve overlap against territory ${defenderTerritory._id.toString()}:`,
        err
      );
    }
  }

  territory.$locals.calonsEarned = totalCalonsEarned;
  // territory.geometry/areaSqm are deliberately untouched here — the spec's
  // "merge overlap into the invader's new territory (turf.union)" step is
  // a mathematical no-op, since overlap is defined as N ∩ T and is
  // therefore already a subset of N. Actually calling turf.union would
  // just reproduce N (with extra floating-point risk from re-running the
  // clip library for nothing), not change anything.
}

/**
 * Full transfer of `overlapAreaSqm` worth of ground from defender to
 * invader — used both by the direct-overwrite branch (invader already has
 * >= Calons) and by applySiegeDamage() once accumulated siege damage
 * crosses the defender's strength threshold. Returns the Calons awarded to
 * the invader for this capture.
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
    // Deliberately NOT touching defenderTerritory.strength here — the spec
    // only ever assigns strength at territory creation (Phase 3) and
    // compares it against siegeDamage (Phase 6); nothing in the phase
    // prompt asks a partial loss to also shrink the "health pool" itself,
    // so this leaves it as-is rather than inventing an unrequested rule.
    if (resetSiegeKey) {
      defenderTerritory.siegeDamage.set(resetSiegeKey, 0);
    }
    await defenderTerritory.save();
  }

  await Notification.create({
    userId: defenderUser._id,
    type: 'territory_invaded',
    payload: {
      territoryId: defenderTerritory._id.toString(),
      invaderId: invaderUser._id.toString(),
      invaderName: invaderUser.name,
      areaLostSqm: overlapAreaSqm,
      fullyConsumed,
      remainingAreaSqm: fullyConsumed ? 0 : remainderAreaSqm,
    },
  });

  // TODO(Phase 10): also notify the INVADER here (type: "invasion_succeeded")
  // once the Phase 10 notification service exists — Phase 6 only asks for
  // the victim's notification, but Phase 10's spec explicitly lists
  // "invasion_succeeded (confirmation to the attacker)" as one it wires in.

  return awardCalonsForAreaGain(invaderUser._id, overlapAreaSqm);
}

/**
 * Siege branch — invader has fewer Calons than the defender, so the
 * overlap only accumulates damage against the defender's territory
 * (weighted by the invader/defender Calons ratio) instead of transferring
 * immediately. Returns the Calons awarded to the invader THIS event (0
 * unless this exact call happens to push siegeDamage over strength and
 * trigger an immediate transfer).
 */
async function applySiegeDamage({ invaderFeature, defenderTerritory, defenderUser, invaderUser, overlapAreaSqm }) {
  const key = invaderUser._id.toString();
  const existingDamage = defenderTerritory.siegeDamage.get(key) || 0;
  // defenderUser.calonsTotal can't be 0 here without also being <= the
  // invader's total (calonsTotal has a schema-level min of 0), which would
  // have routed this candidate into transferOverlap() instead — so this
  // division is safe without an extra epsilon guard.
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

  await Notification.create({
    userId: defenderUser._id,
    type: 'territory_under_siege',
    payload: {
      territoryId: defenderTerritory._id.toString(),
      invaderId: invaderUser._id.toString(),
      invaderName: invaderUser.name,
      siegeDamage: newDamage,
      strength: defenderTerritory.strength,
    },
  });

  return 0; // no ownership change yet, so no Calons this event
}
