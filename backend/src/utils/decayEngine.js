// PHASE 8 — Territory Decay Engine + Streak Stopper (decay half)
//
// Two entry points call into this file:
//
//   1. jobs/decayJobs.js's daily cron -> processDecayForAllEligibleTerritories()
//      Applies ONE DAY of shrink to every territory owned by a user whose
//      lastRunDate is >= INACTIVITY_DAYS_THRESHOLD days stale.
//
//   2. controllers/activityController.js, synchronously right after a
//      qualifying activity is saved -> processActiveDecayForUserRun()
//      Compares today's calories to the user's last-known calories and
//      pauses / reduces / reverses that user's in-progress decay(s)
//      accordingly. This does NOT wait for the next cron tick — the phase
//      prompt is explicit that this happens "before the next cron tick".
//
// Both share the same shrink math (computeShrunkGeometry / shrinkRadially /
// trimLineTerritory) so there's exactly one implementation of "what does
// losing N sqm of territory look like", whether that loss came from a full
// cron day or a partial run-triggered reduction.
//
// ⚠️ KNOWN LIMITATION (concurrency): same as invasionEngine.js/splitEngine.js
// — plain sequential reads/writes, no Mongo transaction. Two decay-affecting
// events landing on the same territory in the same instant (e.g. the cron
// firing at the exact moment a request is mutating the same territory)
// could race. Not addressed here, consistent with the rest of this codebase
// (see invasionEngine.js's header for the fuller rationale).
//
// ⚠️ KNOWN LIMITATION (line decay on a territory that's since been
// partially invaded/split): a line-shaped Territory's `lineMeta.sourceLine`
// is only kept in sync by THIS file (trim/extend). Phase 6/7 mutate
// `territory.geometry` directly via turf.difference when a line territory
// is invaded or sliced, without touching `lineMeta` — so lineMeta can go
// stale relative to the actual current geometry after such an event.
// trimLineTerritory()/extendLineTerritory() are wrapped in a try/catch that
// falls back to the radial-buffer method on any failure, which keeps decay
// from crashing on stale data, but the fallback's shrink shape (radial
// instead of ribbon-end-trim) won't perfectly match the ribbon's visual
// shape in that edge case. Flagging rather than solving, since fixing it
// properly means Phase 6/7 also updating lineMeta on every geometry
// mutation — out of scope for Phase 8 itself.

import * as turf from '@turf/turf';
import User from '../models/User.js';
import Territory from '../models/Territory.js';
import Notification from '../models/Notification.js';
import { AREA_PER_CALORIE } from './territoryEngine.js';

// --- Tunables ---
// "3 days" per spec point v / the Phase 8 prompt's decay trigger.
export const INACTIVITY_DAYS_THRESHOLD = 3;
// daysToZero = clamp(round(0.15 * sqrt(areaSqm)), 3, 30) — spec's literal formula.
export const DECAY_DAYS_TO_ZERO_COEFFICIENT = 0.15;
export const DECAY_DAYS_TO_ZERO_MIN = 3;
export const DECAY_DAYS_TO_ZERO_MAX = 30;
// Below this area, a territory counts as fully decayed and gets deleted
// rather than persisted as an invisible sliver. Spec says "e.g. 50 sqm".
export const DECAY_FLOOR_AREA_SQM = 50;
// Ratio band for "matching intensity" — decay is fully paused for the day.
export const RUN_RATIO_PAUSE_LOW = 0.9;
export const RUN_RATIO_PAUSE_HIGH = 1.1;

function toGeoJSON(geom) {
  return typeof geom?.toObject === 'function' ? geom.toObject() : geom;
}

/**
 * clamp(round(0.15 * sqrt(areaSqm)), 3, 30) — exported for tests/tuning.
 */
export function computeDaysToZero(areaSqm) {
  const raw = Math.round(DECAY_DAYS_TO_ZERO_COEFFICIENT * Math.sqrt(Math.max(areaSqm, 0)));
  return Math.min(DECAY_DAYS_TO_ZERO_MAX, Math.max(DECAY_DAYS_TO_ZERO_MIN, raw));
}

// For a rough circle, area = pi*r^2. Given a current area and a signed
// delta (negative = shrink, positive = grow), returns the radius offset to
// hand to turf.buffer (negative buffers inward, positive buffers outward) —
// this is the exact formula the phase prompt spells out for the shrink
// case, generalized to also cover growth (ratio > 1.1) with the same math.
function estimateRadiusDeltaForAreaChange(currentAreaSqm, deltaAreaSqm) {
  if (currentAreaSqm <= 0) return 0;
  const currentRadius = Math.sqrt(currentAreaSqm / Math.PI);
  const targetArea = currentAreaSqm + deltaAreaSqm;
  const targetRadius = targetArea > 0 ? Math.sqrt(targetArea / Math.PI) : 0;
  return targetRadius - currentRadius;
}

// --- Shrink: loop/random shapes, via radial (turf.buffer) offset ---
function shrinkRadially(territory, shrinkAmountSqm) {
  const radiusDelta = estimateRadiusDeltaForAreaChange(territory.areaSqm, -shrinkAmountSqm);
  const feature = turf.feature(toGeoJSON(territory.geometry));

  let buffered;
  try {
    buffered = turf.buffer(feature, radiusDelta, { units: 'meters' });
  } catch (err) {
    console.warn(
      `[decayEngine] turf.buffer threw during radial shrink for territory ${territory._id.toString()}:`,
      err.message
    );
    return null;
  }
  if (!buffered) return null;

  const newAreaSqm = turf.area(buffered);
  if (!Number.isFinite(newAreaSqm) || newAreaSqm <= DECAY_FLOOR_AREA_SQM) return null;

  return { geometry: buffered.geometry, areaSqm: newAreaSqm };
}

// --- Shrink: line shapes, via trimming the source centerline ---
function trimLineTerritory(territory, shrinkAmountSqm) {
  const { sourceLine, bufferWidthMeters } = territory.lineMeta;
  const lineFeature = turf.lineString(sourceLine.coordinates);
  const currentLengthM = turf.length(lineFeature, { units: 'meters' });

  // Per the phase-8 prompt's literal formula: trim length = shrink / width.
  // (Note: Phase 3 sizes a ribbon as area ~= length * 2*width, i.e. it uses
  // the FULL width, not the half-width, for area math — so this trim
  // formula and Phase 3's sizing formula use width two different ways.
  // That mismatch is in the phase prompt text itself; implemented literally
  // here rather than "corrected" so decay behavior matches what was
  // actually specified.)
  const trimLengthM = shrinkAmountSqm / bufferWidthMeters;
  const newLengthM = currentLengthM - trimLengthM;
  if (newLengthM <= 0) return null; // fully consumed

  // Trim from the end farthest from the path's start — sourceLine.coords[0]
  // is the start (see territoryEngine.js), so slicing [0, newLengthM] keeps
  // the start-anchored portion and cuts the far end, per spec.
  const trimmedLine = turf.lineSliceAlong(lineFeature, 0, newLengthM, { units: 'meters' });
  const buffered = turf.buffer(trimmedLine, bufferWidthMeters, { units: 'meters' });
  if (!buffered) return null;

  const areaSqm = turf.area(buffered);
  if (!Number.isFinite(areaSqm) || areaSqm <= DECAY_FLOOR_AREA_SQM) return null;

  return {
    geometry: buffered.geometry,
    areaSqm,
    lineMeta: { sourceLine: trimmedLine.geometry, bufferWidthMeters },
  };
}

/**
 * Shared shrink resolver used by both the cron's full-day shrink and the
 * run-triggered reduced shrink. Returns null when the shrink consumes the
 * whole territory (caller should delete it), otherwise
 * { geometry, areaSqm, lineMeta? }.
 */
function computeShrunkGeometry(territory, shrinkAmountSqm) {
  if (!Number.isFinite(shrinkAmountSqm) || shrinkAmountSqm <= 0) {
    return { geometry: toGeoJSON(territory.geometry), areaSqm: territory.areaSqm };
  }

  if (territory.shapeType === 'line' && territory.lineMeta && territory.lineMeta.sourceLine) {
    try {
      return trimLineTerritory(territory, shrinkAmountSqm);
    } catch (err) {
      console.warn(
        `[decayEngine] Line-trim decay failed for territory ${territory._id.toString()}, falling back to radial shrink:`,
        err.message
      );
      // fall through to the radial approach below
    }
  }

  return shrinkRadially(territory, shrinkAmountSqm);
}

// --- Growth (ratio > 1.1): loop/random via radial buffer, line via extension ---
function growRadially(territory, bonusAreaSqm) {
  const radiusDelta = estimateRadiusDeltaForAreaChange(territory.areaSqm, bonusAreaSqm);
  const feature = turf.feature(toGeoJSON(territory.geometry));
  let buffered;
  try {
    buffered = turf.buffer(feature, radiusDelta, { units: 'meters' });
  } catch {
    return null;
  }
  if (!buffered) return null;
  return { geometry: buffered.geometry, areaSqm: turf.area(buffered) };
}

function extendLineTerritory(territory, bonusAreaSqm) {
  const { sourceLine, bufferWidthMeters } = territory.lineMeta;
  const coords = sourceLine.coordinates;
  if (!Array.isArray(coords) || coords.length < 2) return null;

  // Same length<->area convention as trimLineTerritory (extend length =
  // bonus / width) — kept symmetric with the trim formula rather than
  // introducing a second convention for growth. Not separately spec'd, so
  // flagged as an extrapolation.
  const extendLengthM = bonusAreaSqm / bufferWidthMeters;
  const last = coords[coords.length - 1];
  const secondLast = coords[coords.length - 2];
  const bearingDeg = turf.bearing(turf.point(secondLast), turf.point(last));
  const newEnd = turf.destination(turf.point(last), extendLengthM, bearingDeg, { units: 'meters' });

  const newLine = turf.lineString([...coords, newEnd.geometry.coordinates]);
  const buffered = turf.buffer(newLine, bufferWidthMeters, { units: 'meters' });
  if (!buffered) return null;

  return {
    geometry: buffered.geometry,
    areaSqm: turf.area(buffered),
    lineMeta: { sourceLine: newLine.geometry, bufferWidthMeters },
  };
}

/**
 * Applies growth to `territory` in place (mutates + saves) and clears its
 * decayState entirely, per spec ("they're back to full health, not just
 * paused"). No-ops (returns without saving) if bonusAreaSqm isn't usable or
 * the geometry op fails outright.
 */
async function growTerritory(territory, bonusAreaSqm) {
  if (!Number.isFinite(bonusAreaSqm) || bonusAreaSqm <= 0) return;

  let result = null;
  if (territory.shapeType === 'line' && territory.lineMeta && territory.lineMeta.sourceLine) {
    try {
      result = extendLineTerritory(territory, bonusAreaSqm);
    } catch (err) {
      console.warn(
        `[decayEngine] Line-extend growth failed for territory ${territory._id.toString()}, falling back to radial growth:`,
        err.message
      );
    }
  }
  if (!result) {
    result = growRadially(territory, bonusAreaSqm);
  }
  if (!result) return; // couldn't grow geometrically — leave the territory untouched rather than error the run

  territory.geometry = result.geometry;
  territory.areaSqm = result.areaSqm;
  if (result.lineMeta) territory.lineMeta = result.lineMeta;
  territory.decayState = { startedAt: null, dailyShrinkRate: null, daysToZero: null };
  await territory.save();
}

/**
 * Deletes a fully-decayed territory and notifies its (former) owner.
 * Shared by both the cron path and the run-triggered reduced-shrink path.
 */
async function deleteFullyDecayedTerritory(territory) {
  await Territory.deleteOne({ _id: territory._id });
  await Notification.create({
    userId: territory.ownerId,
    type: 'territory_fully_decayed',
    payload: { territoryId: territory._id.toString(), shapeType: territory.shapeType },
  });
  // TODO(Phase 10): route this through the real notify(userId, type,
  // payload) service (see invasionEngine.js/splitEngine.js's matching
  // TODOs) once it exists, so the live Socket.io toast fires too.
}

/**
 * One cron-tick's worth of decay for a single territory. Mutates + saves
 * (or deletes) `territory` as appropriate. `user` is the territory's owner,
 * already confirmed stale by the caller.
 *
 * Exported (not just called internally) so it's directly testable/
 * triggerable per-territory without running the full cron sweep.
 */
export async function applyDailyDecayTick({ territory, user, now }) {
  const hasDecayState = !!(territory.decayState && territory.decayState.startedAt);

  if (hasDecayState && territory.decayState.startedAt > now) {
    // Active streak-stopper freeze (see DecayStateSchema's comment in
    // Territory.js). The phase prompt frames "no unused decay freeze
    // active" as a per-USER gate; decayState is per-TERRITORY, so it's
    // expressed here as a per-territory skip instead.
    return { action: 'frozen' };
  }

  const isFirstDay = !hasDecayState;
  
  let dailyShrinkRate;

  if (isFirstDay) {
    const daysToZero = computeDaysToZero(territory.areaSqm);
    dailyShrinkRate = territory.areaSqm / daysToZero;
    territory.decayState = { startedAt: now, dailyShrinkRate, daysToZero };
  }

  const shrinkAmountSqm = territory.decayState.dailyShrinkRate;
  const shrunk = computeShrunkGeometry(territory, shrinkAmountSqm);

  if (!shrunk) {
    await deleteFullyDecayedTerritory(territory);
    return { action: 'fully_decayed' };
  }

  territory.geometry = shrunk.geometry;
  territory.areaSqm = shrunk.areaSqm;
  if (shrunk.lineMeta) territory.lineMeta = shrunk.lineMeta;
  await territory.save();

  if (isFirstDay) {
    // Per spec 1.d: only on the FIRST day shrinkage starts, not every day.
    await Notification.create({
      userId: user._id,
      type: 'decay_warning',
      payload: {
        territoryId: territory._id.toString(),
        dailyShrinkRate,
        daysToZero: territory.decayState.daysToZero,
      },
    });

    // Per spec section 3: offer (don't auto-consume) a Streak Stopper the
    // first time a territory starts shrinking, if the user has one
    // available. Decay itself still proceeds this tick either way — see
    // this file's header / streakStopperController.js for how a user
    // actually freezes it after the fact.
    if (user.streakStoppers > 0) {
      await Notification.create({
        userId: user._id,
        type: 'streak_stopper_offer',
        payload: { territoryId: territory._id.toString(), streakStoppersAvailable: user.streakStoppers },
      });
    }
  }

  return { action: 'shrunk', newAreaSqm: territory.areaSqm };
}

/**
 * Cron entry point (step 1 of the phase prompt): finds every user whose
 * lastRunDate is >= INACTIVITY_DAYS_THRESHOLD days stale, and applies one
 * day of decay to each territory they own (skipping any under an active
 * freeze — see applyDailyDecayTick).
 */
export async function processDecayForAllEligibleTerritories(now = new Date()) {
  const staleCutoff = new Date(now.getTime() - INACTIVITY_DAYS_THRESHOLD * 24 * 60 * 60 * 1000);
  const staleUsers = await User.find({ lastRunDate: { $ne: null, $lte: staleCutoff } }).select(
    '_id streakStoppers'
  );

  let processed = 0;
  for (const user of staleUsers) {
    const territories = await Territory.find({ ownerId: user._id });
    for (const territory of territories) {
      try {
        await applyDailyDecayTick({ territory, user, now });
        processed += 1;
      } catch (err) {
        console.error(
          `[decayEngine] Failed to apply decay tick to territory ${territory._id.toString()}:`,
          err
        );
      }
    }
  }
  console.log(
    `[decayEngine] Daily decay tick processed ${processed} territor${processed === 1 ? 'y' : 'ies'} across ${staleUsers.length} stale user(s).`
  );
}

/**
 * Run-triggered response (step 2 of the phase prompt): call this right
 * after saving a qualifying Activity, BEFORE overwriting
 * user.lastRunCalories with today's value — it reads user.lastRunCalories
 * itself as "the figure from the most recent run before this one".
 *
 * For every territory this user owns that's currently mid-decay
 * (decayState.startedAt is set — including territories currently frozen;
 * a fresh run's effort is honored either way), compares todayCalories to
 * that previous figure and pauses / reduces / reverses decay accordingly.
 *
 * No-ops entirely (returns []) if there's no previous calorie figure to
 * compare against (the user's very first qualifying run ever) or the user
 * owns no territory currently mid-decay.
 */
export async function processActiveDecayForUserRun({ user, todayCalories, now = new Date() }) {
  const previousCalories = user.lastRunCalories;
  if (!previousCalories || previousCalories <= 0) return [];
  if (!Number.isFinite(todayCalories) || todayCalories <= 0) return [];

  const territories = await Territory.find({ ownerId: user._id, 'decayState.startedAt': { $ne: null } });
  if (territories.length === 0) return [];

  const ratio = todayCalories / previousCalories;
  const results = [];

  for (const territory of territories) {
    try {
      if (ratio >= RUN_RATIO_PAUSE_LOW && ratio <= RUN_RATIO_PAUSE_HIGH) {
        // Matching intensity: pause. No geometry/decayState change needed
        // here — activityController.js updates user.lastRunDate to "now"
        // for every qualifying run regardless of ratio, and THAT is what
        // resets the "days since last run" clock the cron checks. There's
        // no separate "consecutive missed days" counter to zero out.
        results.push({ territoryId: territory._id, action: 'paused', ratio });
        continue;
      }

      if (ratio < RUN_RATIO_PAUSE_LOW) {
        const dailyShrinkRate = territory.decayState.dailyShrinkRate || 0;
        const reducedShrinkSqm = dailyShrinkRate * (1 - ratio);
        const shrunk = computeShrunkGeometry(territory, reducedShrinkSqm);

        if (!shrunk) {
          await deleteFullyDecayedTerritory(territory);
          results.push({ territoryId: territory._id, action: 'fully_decayed' });
          continue;
        }

        territory.geometry = shrunk.geometry;
        territory.areaSqm = shrunk.areaSqm;
        if (shrunk.lineMeta) territory.lineMeta = shrunk.lineMeta;
        await territory.save();
        results.push({
          territoryId: territory._id,
          action: 'reduced_shrink',
          ratio,
          shrinkAmountSqm: reducedShrinkSqm,
        });
        continue;
      }

      // ratio > RUN_RATIO_PAUSE_HIGH — territory grows instead of shrinking.
      const bonusAreaSqm = (todayCalories - previousCalories) * AREA_PER_CALORIE;
      await growTerritory(territory, bonusAreaSqm);
      results.push({ territoryId: territory._id, action: 'grown', ratio, bonusAreaSqm });
    } catch (err) {
      console.error(
        `[decayEngine] Failed to process run-triggered decay response for territory ${territory._id.toString()}:`,
        err
      );
    }
  }

  return results;
}
