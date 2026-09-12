import cron from 'node-cron';
import User from '../models/User.js';
import Activity from '../models/Activity.js';
import { notify } from '../utils/notificationService.js'; // Phase 10
import { processDecayForAllEligibleTerritories } from '../utils/decayEngine.js';

// node-cron fields are: minute hour day-of-month month day-of-week
const DAILY_DECAY_CRON = '0 0 * * *'; // every day at 00:00 server time

export const STREAK_STOPPER_MILESTONE_DAYS = 30;

// Returns the [start, end) window for the calendar day immediately before
// `now`, in server-local time.
function getYesterdayRange(now) {
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  dayStart.setDate(dayStart.getDate() - 1);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);
  return { dayStart, dayEnd };
}

/**
 * STREAK STOPPER / currentStreak: increments currentStreak for every user
 * with at least one isValidForTerritory Activity on the calendar day that
 * just ended, resets it to 0 for every other user who had a nonzero
 * streak, and awards a Streak Stopper (+ notification) whenever a streak
 * lands on a STREAK_STOPPER_MILESTONE_DAYS multiple.
 */
export async function processStreaksForYesterday(now = new Date()) {
  const { dayStart, dayEnd } = getYesterdayRange(now);

  const ranYesterdayUserIds = await Activity.distinct('userId', {
    isValidForTerritory: true,
    createdAt: { $gte: dayStart, $lt: dayEnd },
  });

  if (ranYesterdayUserIds.length > 0) {
    await User.updateMany({ _id: { $in: ranYesterdayUserIds } }, { $inc: { currentStreak: 1 } });

    // Re-fetch post-increment values to check the milestone.
    const updatedUsers = await User.find({ _id: { $in: ranYesterdayUserIds } }).select('_id currentStreak');
    for (const u of updatedUsers) {
      if (u.currentStreak > 0 && u.currentStreak % STREAK_STOPPER_MILESTONE_DAYS === 0) {
        await User.findByIdAndUpdate(u._id, { $inc: { streakStoppers: 1 } });
        // PHASE 10: notify() instead of a bare Notification.create().
        await notify(u._id, 'streak_stopper_earned', { currentStreak: u.currentStreak });
      }
    }
  }

  await User.updateMany(
    { _id: { $nin: ranYesterdayUserIds }, currentStreak: { $gt: 0 } },
    { $set: { currentStreak: 0 } }
  );

  console.log(
    `[cron] Streak update — ${ranYesterdayUserIds.length} user(s) ran yesterday; streak reset for everyone else with a nonzero streak.`
  );
}

/**
 * Runs both Phase 8 daily jobs in sequence: streaks first, then the decay
 * sweep.
 */
export async function runDailyDecayAndStreakJob(now = new Date()) {
  await processStreaksForYesterday(now);
  await processDecayForAllEligibleTerritories(now);
}

export function registerDecayJobs() {
  cron.schedule(DAILY_DECAY_CRON, () => {
    runDailyDecayAndStreakJob().catch((err) => console.error('[cron] Daily decay/streak job failed:', err));
  });
  console.log('[cron] Registered daily decay + streak job.');
}
