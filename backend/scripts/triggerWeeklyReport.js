// PHASE 11 helper — NOT part of the running app. Manually fires the weekly
// report email job so you don't have to wait for a real Monday 06:00 to
// verify it (see the Phase 11 Definition of Done: "manually trigger the
// job function ... confirm a real email arrives").
//
// Before running this:
//   1. Fill in the SMTP_* vars in backend/.env (see backend/.env.example) —
//      Ethereal (https://ethereal.email) is a good free option that gives
//      you a fake inbox + preview link without sending real mail.
//   2. Run `node backend/scripts/markEmailVerified.js you@example.com` on
//      whichever test account you want the report sent to (emailVerified
//      defaults to false — no phase has built a real verification flow yet).
//   3. Make sure that account has at least one Activity, and that the Phase
//      5 weekly Calons reset has actually run for the most recent week
//      (`node backend/scripts/triggerCalonsReset.js weekly` if you haven't
//      let the real Monday-00:00 cron fire yet) — this job reads that
//      snapshot, not live data.
//
// Usage (from the repo root):
//   node backend/scripts/triggerWeeklyReport.js

import dotenv from 'dotenv';
dotenv.config({ path: './backend/.env' });

import mongoose from 'mongoose';
import { connectDB } from '../src/config/db.js';
import { runWeeklyReportJob } from '../src/jobs/weeklyReportJobs.js';

const dateArg = process.argv[2];
const now = dateArg ? new Date(dateArg) : new Date();

if (Number.isNaN(now.getTime())) {
  console.error(`[script] Invalid date: ${dateArg}`);
  process.exit(1);
}

async function main() {
  await connectDB();
  await runWeeklyReportJob(now);
  console.log('[script] Manual weekly report run complete.');
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('[script] Failed:', err);
  process.exit(1);
});