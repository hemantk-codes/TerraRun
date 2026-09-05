// One-off manual trigger for Phase 8's decay + streak cron — lets you test
// the phase's Definition of Done ("manually backdate a test user's
// lastRunDate by 4 days in the DB, run the cron job manually, and confirm
// their territory visibly shrinks...") without waiting for a real midnight.
// Same pattern as the (referenced-but-not-shown) scripts/triggerCalonsReset.js
// from Phase 5.
//
// Usage:
//   node backend/src/scripts/triggerDecayJob.js
//
// Make sure backend/.env has a working MONGODB_URI pointed at your dev DB
// before running this — it connects for real and writes for real.

import dotenv from 'dotenv';
dotenv.config({ path: 'backend/.env' });

import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import { runDailyDecayAndStreakJob } from '../jobs/decayJobs.js';
import '../models/index.js';

async function main() {
  await connectDB();
  await runDailyDecayAndStreakJob(new Date());
  console.log('[script] Manual decay + streak job run complete.');
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('[script] Failed:', err);
  process.exit(1);
});
