import User from '../models/User.js';

// --- GAME-BALANCE constant — tune by playtesting, not physically derived.
// Same "one tunable knob" pattern as AREA_PER_CALORIE in territoryEngine.js.
// Calons awarded per sqm of NEW territory area gained.
export const POINTS_PER_SQM = 0.1;

/**
 * Awards Calons for `areaSqmGained` sqm of territory to `userId`.
 *
 * - calonsTotal is monotonic — only ever incremented here, never reset by
 *   the weekly/monthly cron jobs below. This is the "Snapchat score"-style
 *   all-time counter the spec calls for.
 * - calonsWeekly / calonsMonthly get the SAME increment as calonsTotal —
 *   they're independently-reset VIEWS onto the same award stream, not a
 *   separately-computed amount.
 *
 * Called from activityController.js right after Phase 3 creates a
 * territory. Kept as its own function (not inlined in the controller) so
 * Phase 6/7's invasion code — which also grants area — can call the exact
 * same award path instead of duplicating the calculation.
 *
 * Returns the calonsEarned amount (0 for a non-positive/invalid gain — a
 * defensive no-op, not an error, since invasion code may call this with a
 * shrinking delta in edge cases).
 */
export async function awardCalonsForAreaGain(userId, areaSqmGained) {
  if (!Number.isFinite(areaSqmGained) || areaSqmGained <= 0) return 0;

  const calonsEarned = areaSqmGained * POINTS_PER_SQM;

  await User.findByIdAndUpdate(userId, {
    $inc: {
      calonsTotal: calonsEarned,
      calonsWeekly: calonsEarned,
      calonsMonthly: calonsEarned,
    },
  });

  return calonsEarned;
}
