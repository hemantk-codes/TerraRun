import cron from 'node-cron';
import User from '../models/User.js';
import WeeklyScore from '../models/WeeklyScore.js';
import MonthlyScore from '../models/MonthlyScore.js';

// --- Tunables — node-cron fields are: minute hour day-of-month month day-of-week ---
const WEEKLY_RESET_CRON = '0 0 * * 1'; // every Monday, 00:00 server time
const MONTHLY_RESET_CRON = '0 0 1 * *'; // the 1st of every month, 00:00 server time

// weekStartDate/monthStartDate describe the week/month that JUST CLOSED.
// Since each job fires exactly at that boundary instant (Monday 00:00 /
// 1st-of-month 00:00), "just closed" means 7 days back / one calendar month
// back from `now`.
function getJustEndedWeekStart(now = new Date()) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - 7);
  return d;
}

function getJustEndedMonthStart(now = new Date()) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return d;
}

/**
 * Snapshots every user's CURRENT calonsWeekly into WeeklyScore, then resets
 * calonsWeekly to 0. calonsTotal is never touched here — it's monotonic by
 * design (see calonsEngine.js).
 *
 * Exported directly (not just registered as a cron callback) so it can be
 * called on demand — see scripts/triggerCalonsReset.js — without waiting
 * for a real Monday to test it.
 */
export async function runWeeklyReset(now = new Date()) {
  const weekStartDate = getJustEndedWeekStart(now);
  const users = await User.find({ calonsWeekly: { $gt: 0 } }).select('_id calonsWeekly');

  if (users.length > 0) {
    await WeeklyScore.insertMany(
      users.map((u) => ({ userId: u._id, weekStartDate, score: u.calonsWeekly }))
    );
  }

  await User.updateMany({}, { $set: { calonsWeekly: 0 } });
  console.log(
    `[cron] Weekly Calons reset — snapshotted ${users.length} user(s) for the week of ${weekStartDate.toISOString()}`
  );
}

/** Same idea as runWeeklyReset, for the monthly cycle. */
export async function runMonthlyReset(now = new Date()) {
  const monthStartDate = getJustEndedMonthStart(now);
  const users = await User.find({ calonsMonthly: { $gt: 0 } }).select('_id calonsMonthly');

  if (users.length > 0) {
    await MonthlyScore.insertMany(
      users.map((u) => ({ userId: u._id, monthStartDate, score: u.calonsMonthly }))
    );
  }

  await User.updateMany({}, { $set: { calonsMonthly: 0 } });
  console.log(
    `[cron] Monthly Calons reset — snapshotted ${users.length} user(s) for the month of ${monthStartDate.toISOString()}`
  );
}

// TODO(Phase 10): "leaderboard_overtaken" notifications are supposed to be
// checked HERE (per the Phase 10 prompt: "check this in the Phase 5
// weekly/monthly cron jobs, not on every single run") — i.e. after each
// reset, compare each user's just-snapshotted rank against their previous
// snapshot and notify anyone a friend/regional peer passed. Deliberately
// NOT implemented yet since Notification wiring is explicitly Phase 10's
// job and the Friendship-based "friends" scope doesn't exist until Phase 9
// either — both runWeeklyReset/runMonthlyReset are natural places to add
// that check once those phases land.

/**
 * Registers both jobs on the real cron schedule. Call once from server.js
 * after the DB connects. Kept as an explicit opt-in step (rather than
 * scheduling at module-import time) so the manual-trigger script and any
 * future tests can import runWeeklyReset/runMonthlyReset directly without
 * silently also wiring up a second, real scheduled job.
 */
export function registerCalonsResetJobs() {
  cron.schedule(WEEKLY_RESET_CRON, () => {
    runWeeklyReset().catch((err) => console.error('[cron] Weekly Calons reset failed:', err));
  });
  cron.schedule(MONTHLY_RESET_CRON, () => {
    runMonthlyReset().catch((err) => console.error('[cron] Monthly Calons reset failed:', err));
  });
  console.log('[cron] Registered weekly + monthly Calons reset jobs.');
}
