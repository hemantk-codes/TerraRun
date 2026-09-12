import cron from 'node-cron';
import User from '../models/User.js';
import WeeklyScore from '../models/WeeklyScore.js';
import MonthlyScore from '../models/MonthlyScore.js';
import { checkAndNotifyOvertakes } from '../utils/leaderboardOvertakeEngine.js'; // Phase 10

// --- Tunables — node-cron fields are: minute hour day-of-month month day-of-week ---
const WEEKLY_RESET_CRON = '0 0 * * 1'; // every Monday, 00:00 server time
const MONTHLY_RESET_CRON = '0 0 1 * *'; // the 1st of every month, 00:00 server time

// weekStartDate/monthStartDate describe the week/month that JUST CLOSED.
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

// PHASE 10 — the period immediately BEFORE the one that just closed, i.e.
// what leaderboardOvertakeEngine.js diffs against. Plain subtraction is
// exact for weekly (always 7 days); setMonth() correctly handles monthly's
// variable day-count the same way getJustEndedMonthStart already does.
function getPreviousWeekStart(justEndedWeekStart) {
  return new Date(justEndedWeekStart.getTime() - 7 * 24 * 60 * 60 * 1000);
}

function getPreviousMonthStart(justEndedMonthStart) {
  const d = new Date(justEndedMonthStart);
  d.setMonth(d.getMonth() - 1);
  return d;
}

/**
 * Snapshots every user's CURRENT calonsWeekly into WeeklyScore, then resets
 * calonsWeekly to 0. calonsTotal is never touched here — it's monotonic by
 * design (see calonsEngine.js).
 */
export async function runWeeklyReset(now = new Date()) {
  const weekStartDate = getJustEndedWeekStart(now);
  const users = await User.find({ calonsWeekly: { $gt: 0 } }).select('_id calonsWeekly region');

  // PHASE 10 — must run BEFORE calonsWeekly is reset to 0 below (needs the
  // live pre-reset values). Reads LAST week's already-committed
  // WeeklyScore snapshot to diff against, so it doesn't matter whether
  // this runs before or after this week's own snapshot insert just below.
  await checkAndNotifyOvertakes({
    period: 'weekly',
    scoreField: 'calonsWeekly',
    justEndedPeriodStart: weekStartDate,
    previousPeriodStart: getPreviousWeekStart(weekStartDate),
    users,
  });

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
  const users = await User.find({ calonsMonthly: { $gt: 0 } }).select('_id calonsMonthly region');

  await checkAndNotifyOvertakes({
    period: 'monthly',
    scoreField: 'calonsMonthly',
    justEndedPeriodStart: monthStartDate,
    previousPeriodStart: getPreviousMonthStart(monthStartDate),
    users,
  });

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

/**
 * Registers both jobs on the real cron schedule. Call once from server.js
 * after the DB connects.
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
