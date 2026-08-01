import Activity from '../models/Activity.js';
import User from '../models/User.js';
import { computeActivityMetrics, MIN_DISTANCE_KM_FOR_TERRITORY } from '../utils/calorieEngine.js';

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

    // TODO(Phase 3): if (isValidForTerritory) { await generateTerritory(activity, user); }
    //   and set activity.territoryId to the result. Left as a hook per the
    //   Phase 2 spec ("skip territory generation entirely... just leave the
    //   hook/TODO").
    // TODO(Phase 8): update user.lastRunDate / user.lastRunCalories /
    //   currentStreak here once the streak/decay engine exists. Not touched
    //   in Phase 2 so this route doesn't silently diverge from what Phase 8
    //   expects to own.

    res.status(201).json({ activity });
  } catch (err) {
    next(err);
  }
}
