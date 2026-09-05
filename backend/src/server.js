import 'dotenv/config';
import { createApp } from './app.js';
import { connectDB } from './config/db.js';
import { registerCalonsResetJobs } from './jobs/calonsResetJobs.js'; // Phase 5
import { registerDecayJobs } from './jobs/decayJobs.js'; // Phase 8

// Importing this confirms all schemas compile and register with Mongoose
// with zero errors — part of the Phase 0 definition of done.
import './models/index.js';

const PORT = process.env.PORT || 5000;

async function start() {
  await connectDB();

  // Cron jobs touch the DB (User/Territory/Activity/Notification/etc.), so
  // register them only after connectDB() resolves.
  registerCalonsResetJobs();
  registerDecayJobs();

  const app = createApp();

  app.listen(PORT, () => {
    console.log(`[server] TerraRun backend listening on http://localhost:${PORT}`);
    console.log(`[server] Health check: http://localhost:${PORT}/api/health`);
  });
}

start().catch((err) => {
  console.error('[server] Failed to start:', err);
  process.exit(1);
});
