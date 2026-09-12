// PHASE 8 — Territory Decay Engine + Streak Stopper (decay half)
// PHASE 10 UPDATE — all three bare `Notification.create(...)` calls this
// file used to make (territory_fully_decayed, decay_warning,
// streak_stopper_offer) now go through notify() instead, so each one also
// pushes a live Socket.io toast, not just a silent DB row.
//
// (All other header notes from Phase 8 — the two entry points, the shared
// shrink math, the concurrency/line-decay known limitations — are
// unchanged.)

import * as turf from '@turf/turf';
import User from '../models/User.js';
import Territory from '../models/Territory.js';
import { notify } from './notificationService.js'; // Phase 10
import { AREA_PER_CALORIE } from './territoryEngine.js';

// --- Tunables ---
export const INACTIVITY_DAYS_THRESHOLD = 3;
export const DECAY_DAYS_TO_ZERO_COEFFICIENT = 0.15;
export const DECAY_DAYS_TO_ZERO_MIN = 3;
export const DECAY_DAYS_TO_ZERO_MAX = 30;
export const DECAY_FLOOR_AREA_SQM = 50;
export const RUN_RATIO_PAUSE_LOW = 0.9;
export const RUN_RATIO_PAUSE_HIGH = 1.1;

function toGeoJSON(geom) {
  return typeof geom?.toObject === 'function' ? geom.toObject() : geom;
}

export function computeDaysToZero(areaSqm) {
  const raw = Math.round(DECAY_DAYS_TO_ZERO_COEFFICIENT * Math.sqrt(Math.max(areaSqm, 0)));
  return Math.min(DECAY_DAYS_TO_ZERO_MAX, Math.max(DECAY_DAYS_TO_ZERO_MIN, raw));
}

function estimateRadiusDeltaForAreaChange(currentAreaSqm, deltaAreaSqm) {
  if (currentAreaSqm <= 0) return 0;
  const currentRadius = Math.sqrt(currentAreaSqm / Math.PI);
  const targetArea = currentAreaSqm + deltaAreaSqm;
  const targetRadius = targetArea > 0 ? Math.sqrt(targetArea / Math.PI) : 0;
  return targetRadius - currentRadius;
}

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

function trimLineTerritory(territory, shrinkAmountSqm) {
  const { sourceLine, bufferWidthMeters } = territory.lineMeta;
  const lineFeature = turf.lineString(sourceLine.coordinates);
  const currentLengthM = turf.length(lineFeature, { units: 'meters' });

  const trimLengthM = shrinkAmountSqm / bufferWidthMeters;
  const newLengthM = currentLengthM - trimLengthM;
  if (newLengthM <= 0) return null; // fully consumed

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
    }
  }

  return shrinkRadially(territory, shrinkAmountSqm);
}

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
  if (!result) return; // couldn't grow geometrically — leave the territory untouched

  territory.geometry = result.geometry;
  territory.areaSqm = result.areaSqm;
  if (result.lineMeta) territory.lineMeta = result.lineMeta;
  territory.decayState = { startedAt: null, dailyShrinkRate: null, daysToZero: null };
  await territory.save();
}

/**
 * Deletes a fully-decayed territory and notifies its (former) owner.
 * PHASE 10: now routed through notify() instead of a bare
 * Notification.create() — pushes a live toast in addition to the DB row.
 */
async function deleteFullyDecayedTerritory(territory) {
  await Territory.deleteOne({ _id: territory._id });
  await notify(territory.ownerId, 'territory_fully_decayed', {
    territoryId: territory._id.toString(),
    shapeType: territory.shapeType,
  });
}

/**
 * One cron-tick's worth of decay for a single territory.
 */
export async function applyDailyDecayTick({ territory, user, now }) {
  const hasDecayState = !!(territory.decayState && territory.decayState.startedAt);

  if (hasDecayState && territory.decayState.startedAt > now) {
    // Active streak-stopper freeze.
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
    // PHASE 10: notify() instead of a bare Notification.create().
    await notify(user._id, 'decay_warning', {
      territoryId: territory._id.toString(),
      dailyShrinkRate,
      daysToZero: territory.decayState.daysToZero,
    });

    // Offer (don't auto-consume) a Streak Stopper the first time a
    // territory starts shrinking, if the user has one available.
    if (user.streakStoppers > 0) {
      await notify(user._id, 'streak_stopper_offer', {
        territoryId: territory._id.toString(),
        streakStoppersAvailable: user.streakStoppers,
      });
    }
  }

  return { action: 'shrunk', newAreaSqm: territory.areaSqm };
}

/**
 * Cron entry point: finds every user whose lastRunDate is stale, and
 * applies one day of decay to each territory they own.
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
 * Run-triggered response: call right after saving a qualifying Activity,
 * BEFORE overwriting user.lastRunCalories with today's value.
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
