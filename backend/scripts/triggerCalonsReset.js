// PHASE 5 helper — NOT part of the running app. Manually fires the weekly
// and/or monthly Calons reset jobs so you don't have to wait for a real
// Monday/1st-of-month to verify the snapshot + reset logic (see the Phase 5
// Definition of Done: "Manually trigger the cron jobs...").
//
// Usage (from the repo root):
//   node backend/scripts/triggerCalonsReset.js weekly
//   node backend/scripts/triggerCalonsReset.js monthly
//   node backend/scripts/triggerCalonsReset.js both

import dotenv from 'dotenv';
dotenv.config({ path: './backend/.env' });

import mongoose from 'mongoose';
import { connectDB } from '../src/config/db.js';
import { runWeeklyReset, runMonthlyReset } from '../src/jobs/calonsResetJobs.js';

const mode = process.argv[2] || 'weekly';

async function main() {
  await connectDB();

  if (mode === 'monthly') {
    await runMonthlyReset();
  } else if (mode === 'both') {
    await runWeeklyReset();
    await runMonthlyReset();
  } else {
    await runWeeklyReset();
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('[trigger] Failed:', err);
  process.exit(1);
});
