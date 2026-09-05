import User from '../models/User.js';
import Territory from '../models/Territory.js';

// Spec: "pauses decay for three additional days".
const STREAK_STOPPER_FREEZE_DAYS = 3;

/**
 * POST /api/streak-stoppers/use
 * Body: { territoryId }
 *
 * Decrements the authenticated user's streakStoppers by 1 and pushes the
 * target territory's decayState.startedAt forward by
 * STREAK_STOPPER_FREEZE_DAYS days — utils/decayEngine.js's daily tick
 * treats any territory whose decayState.startedAt is still in the future
 * as "frozen" and skips it entirely (see applyDailyDecayTick), which is
 * exactly the "3 more days of no shrinkage" the spec asks for.
 *
 * If a freeze is already active (a previous use hasn't expired yet), the
 * new 3 days are stacked on top of the existing freeze's end rather than
 * on top of "now" — consecutive uses extend the freeze instead of
 * resetting it to a shorter one.
 *
 * ⚠️ Requires the territory to currently have an active decayState
 * (decayState.startedAt set) — using a stopper on healthy territory isn't
 * meaningful, so this rejects that case with a 400 rather than silently
 * spending the user's stopper for nothing.
 */
export async function useStreakStopper(req, res, next) {
  try {
    const userId = req.userId || req.user?.id || req.user?._id;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated.' });
    }

    const { territoryId } = req.body;
    if (!territoryId) {
      return res.status(400).json({ error: 'territoryId is required.' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }
    if (!user.streakStoppers || user.streakStoppers <= 0) {
      return res.status(400).json({ error: 'No Streak Stoppers available.' });
    }

    const territory = await Territory.findOne({ _id: territoryId, ownerId: user._id });
    if (!territory) {
      return res.status(404).json({ error: 'Territory not found or not owned by you.' });
    }
    if (!territory.decayState || !territory.decayState.startedAt) {
      return res.status(400).json({ error: 'This territory is not currently decaying.' });
    }

    const now = new Date();
    // Stack on top of the later of "now" or the existing startedAt, so a
    // second stopper used mid-freeze extends it rather than shortening it.
    const base = territory.decayState.startedAt > now ? territory.decayState.startedAt : now;
    territory.decayState.startedAt = new Date(base.getTime() + STREAK_STOPPER_FREEZE_DAYS * 24 * 60 * 60 * 1000);
    await territory.save();

    user.streakStoppers -= 1;
    await user.save();

    res.status(200).json({
      streakStoppers: user.streakStoppers,
      territory: {
        _id: territory._id,
        decayState: territory.decayState,
      },
    });
  } catch (err) {
    next(err);
  }
}
