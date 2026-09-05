import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { useStreakStopper } from '../controllers/streakStopperController.js';

const router = Router();

// POST /api/streak-stoppers/use — body: { territoryId }
router.post('/use', requireAuth, useStreakStopper);

export default router;
