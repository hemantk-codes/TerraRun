import { Router } from 'express';
import mongoose from 'mongoose';

const router = Router();

// GET /api/health — used by the Phase 0 definition-of-done check, and handy
// later for uptime monitors / deployment health checks (Phase 13).
router.get('/', (req, res) => {
  const dbStates = ['disconnected', 'connected', 'connecting', 'disconnecting'];

  res.status(200).json({
    status: 'ok',
    uptimeSec: Math.round(process.uptime()),
    db: dbStates[mongoose.connection.readyState] ?? 'unknown',
    timestamp: new Date().toISOString(),
  });
});

export default router;
