// PHASE 11 — Weekly Report Emails.
import cron from 'node-cron';
import User from '../models/User.js';
import { getJustEndedWeekRange, compileWeeklyReportForUser } from '../utils/weeklyReportEngine.js';
import { buildWeeklyReportEmail } from '../utils/emailTemplates.js';
import { sendMail } from '../utils/mailer.js';

// Every Monday 06:00 server time — deliberately AFTER calonsResetJobs.js's
// WEEKLY_RESET_CRON ('0 0 * * 1', Monday 00:00), so this job's "week that
// just closed" always has a committed WeeklyScore snapshot to read (see
// weeklyReportEngine.js's header for why that ordering matters).
const WEEKLY_REPORT_CRON = '0 6 * * 1';

function formatWeekLabel(weekStart, weekEnd) {
  const lastDay = new Date(weekEnd.getTime() - 24 * 60 * 60 * 1000);
  const fmt = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${fmt(weekStart)} – ${fmt(lastDay)}`;
}

/**
 * Sends the weekly report to every eligible user for the week that just
 * closed relative to `now`. Exported (not just registered on a cron
 * schedule) so it can be triggered manually for testing — see
 * backend/scripts/triggerWeeklyReport.js — same pattern as
 * calonsResetJobs.js's runWeeklyReset/runMonthlyReset.
 */
export async function runWeeklyReportJob(now = new Date()) {
  const { weekStart, weekEnd } = getJustEndedWeekRange(now);

  // ELIGIBILITY: `emailVerified` and `weeklyEmailOptOut` are exactly the two
  // fields User.js's schema comment earmarked for this phase. No phase has
  // built a real email-verification flow yet (out of scope here — it'd need
  // its own token+link endpoint), so emailVerified defaults false and stays
  // that way for every user unless flipped manually. For testing, use
  // backend/scripts/markEmailVerified.js on a test account rather than
  // relaxing this check — keeping it strict is what makes "verified email"
  // actually mean something once a real verification flow does land.
  const users = await User.find({
    email: { $exists: true, $ne: null },
    emailVerified: true,
    weeklyEmailOptOut: false,
  }).select('_id name email region');

  let sent = 0;
  let skipped = 0;

  for (const user of users) {
    try {
      const report = await compileWeeklyReportForUser(user, { weekStart, weekEnd });
      const weekLabel = formatWeekLabel(weekStart, weekEnd);

      const html = buildWeeklyReportEmail({
        name: user.name,
        weekLabel,
        appUrl: process.env.APP_BASE_URL || 'http://localhost:5173',
        ...report,
      });

      const result = await sendMail({
        to: user.email,
        subject: `Your TerraRun week: ${weekLabel}`,
        html,
      });

      if (result.sent) {
        sent += 1;
      } else {
        skipped += 1;
      }
    } catch (err) {
      console.error(`[weeklyReportJobs] Failed to build/send report for ${user.email}:`, err);
      skipped += 1;
    }
  }

  console.log(
    `[cron] Weekly report emails — sent ${sent}, skipped ${skipped} (of ${users.length} eligible user(s)) ` +
      `for the week of ${weekStart.toISOString()}.`
  );
}

export function registerWeeklyReportJobs() {
  cron.schedule(WEEKLY_REPORT_CRON, () => {
    runWeeklyReportJob().catch((err) => console.error('[cron] Weekly report job failed:', err));
  });
  console.log('[cron] Registered weekly report email job.');
}