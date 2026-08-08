import Activity from '../models/Activity.js';
import User from '../models/User.js';
import { computeActivityMetrics, MIN_DISTANCE_KM_FOR_TERRITORY } from '../utils/calorieEngine.js';
import { generateTerritory } from '../utils/territoryEngine.js';
import { awardCalonsForAreaGain } from '../utils/calonsEngine.js'; // Phase 5
import { resolveInvasions } from '../utils/invasionEngine.js'; // Phase 6

/**
 * POST /api/activities
 *
 * Body: { gpsPath: [{lat,lng,ele,t}, ...], startTime?, endTime? }
 * (startTime/endTime are optional — if omitted, derived from the first/last
 * gpsPath timestamps.)
 *
 * ⚠️ INTEGRATION ASSUMPTION (Phase 1 dependency): this handler assumes it's
 * mounted behind an auth middleware that verifies the JWT access token and
 * attaches the authenticated user's id as `req.user.id` or `req.user._id`
 * (see routes/activities.js). Phase 1's actual files weren't in this
 * session's context, so double-check that shape matches what your real
 * middleware sets — adjust the `userId` line below if it differs (e.g. if
 * your middleware sets `req.userId` directly instead of `req.user.id`).
 */
export async function createActivity(req, res, next) {
  try {
    const { gpsPath, startTime, endTime } = req.body;

    if (!Array.isArray(gpsPath) || gpsPath.length < 2) {
      return res.status(400).json({ error: 'gpsPath must contain at least 2 GPS points.' });
    }
    for (const p of gpsPath) {
      if (typeof p.lat !== 'number' || typeof p.lng !== 'number' || !p.t) {
        return res.status(400).json({ error: 'Every gpsPath point needs numeric lat/lng and a timestamp t.' });
      }
    }

    const userId = req.user?.id || req.user?._id || req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated.' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    if (!user.bodyWeightKg) {
      // The calorie formula needs body weight. Phase 1's profile CRUD
      // should have collected this — guarding here rather than silently
      // falling back to an assumed weight, since that would produce
      // calorie numbers (and therefore territory size, Phase 3) that don't
      // actually reflect the user.
      return res.status(400).json({
        error: 'Set your body weight in your profile before recording an activity.',
      });
    }

    const metrics = computeActivityMetrics(gpsPath, user.bodyWeightKg);

    const isVehicle = metrics.activityType === 'vehicle';
    const meetsMinDistance = metrics.distanceKm >= MIN_DISTANCE_KM_FOR_TERRITORY;
    // Spec points x/xi: both the 1km minimum AND the vehicle heuristic gate
    // territory generation. A <1km vehicle trip is still just "invalid",
    // not double-flagged — this is a single boolean either way.
    const isValidForTerritory = !isVehicle && meetsMinDistance;

    const activity = await Activity.create({
      userId: user._id,
      startTime: startTime ? new Date(startTime) : new Date(gpsPath[0].t),
      endTime: endTime ? new Date(endTime) : new Date(gpsPath[gpsPath.length - 1].t),
      gpsPath,
      distanceKm: metrics.distanceKm,
      elevationGainM: metrics.elevationGainM,
      durationSec: metrics.durationSec,
      calories: metrics.calories,
      activityType: metrics.activityType,
      isLoop: metrics.isLoop,
      isValidForTerritory,
      territoryId: null,
    });

    // --- PHASE 3: territory generation ---
    // Deliberately NOT wrapped around the Activity.create above — the
    // activity (and the user's run stats) is saved either way; territory
    // generation is a second, best-effort step on top of it. If it throws
    // (a genuine geometry edge case — e.g. a degenerate near-zero-area
    // loop), we log it and return the activity with territoryId left null
    // rather than losing the user's recorded run over it.
    let territory = null;
    let calonsEarned = 0;
    if (isValidForTerritory) {
      try {
        // Phase 6: onBeforeSave runs resolveInvasions() against the new
        // territory BEFORE it's persisted (see invasionEngine.js /
        // territoryEngine.js). It's a no-op for line/random shapeTypes and
        // for loops with no enemy overlap — in both cases this behaves
        // exactly like pre-Phase-6 generateTerritory(activity, user) did.
        territory = await generateTerritory(activity, user, { onBeforeSave: resolveInvasions });
        activity.territoryId = territory._id;
        await activity.save();

        // --- PHASE 5/6: award Calons for the newly created territory ---
        if (territory.shapeType === 'loop') {
          // resolveInvasions() already awarded Calons for this territory
          // (the unclaimed portion of areaSqm, plus any enemy overlap it
          // successfully captured this event — see invasionEngine.js).
          // Awarding again here off territory.areaSqm would double-count:
          // areaSqm doesn't shrink or grow as a result of invasion (the
          // spec's "merge overlap into the invader's territory" step is a
          // geometric no-op — overlap is by definition already part of
          // the invader's polygon), so it isn't a safe number to award
          // against a second time.
          calonsEarned = territory.$locals.calonsEarned ?? 0;
        } else {
          // line/random territories never go through invasion resolution
          // (Phase 6 only checks loops), so the whole new area is virgin
          // ground exactly as it was before Phase 6 existed.
          calonsEarned = await awardCalonsForAreaGain(user._id, territory.areaSqm);
        }
      } catch (err) {
        console.error(
          `[territoryEngine] Failed to generate territory for activity ${activity._id.toString()}:`,
          err
        );
      }
    }

    // TODO(Phase 8): update user.lastRunDate / user.lastRunCalories /
    //   currentStreak here once the streak/decay engine exists. Not touched
    //   in Phase 2/3 so this route doesn't silently diverge from what
    //   Phase 8 expects to own.

    res.status(201).json({ activity, territory, calonsEarned });
  } catch (err) {
    next(err);
  }
}
