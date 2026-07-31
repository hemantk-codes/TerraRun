import 'dotenv/config';
import { createApp } from './app.js';
import { connectDB } from './config/db.js';

// Importing this confirms all 6 schemas compile and register with Mongoose
// with zero errors — part of the Phase 0 definition of done.
import './models/index.js';

const PORT = process.env.PORT || 5000;

async function start() {
  await connectDB();

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
