// PHASE 11 helper — NOT part of the running app. Flips a test user's
// User.emailVerified to true so you can exercise the weekly-report job
// without building a real email-verification flow (that's out of scope for
// this phase — the schema field exists for when one does land).
//
// Usage (from the repo root):
//   node backend/scripts/markEmailVerified.js you@example.com

import dotenv from 'dotenv';
dotenv.config({ path: './backend/.env' });

import mongoose from 'mongoose';
import { connectDB } from '../src/config/db.js';
import User from '../src/models/User.js';

const email = process.argv[2];

if (!email) {
  console.error('Usage: node backend/scripts/markEmailVerified.js <email>');
  process.exit(1);
}

async function main() {
  await connectDB();

  const user = await User.findOneAndUpdate(
    { email: email.trim().toLowerCase() },
    { $set: { emailVerified: true } },
    { new: true }
  );

  if (!user) {
    console.error(`[script] No user found with email "${email}".`);
    process.exitCode = 1;
  } else {
    console.log(`[script] ${user.email} is now marked emailVerified: true.`);
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('[script] Failed:', err);
  process.exit(1);
});