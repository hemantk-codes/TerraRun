import { Router } from 'express';
import { getLeaderboard } from '../controllers/leaderboardController.js';

const router = Router();

// GET /api/leaderboard?scope=friends|regional&period=weekly|monthly&region=<>&limit=<>
router.get('/', getLeaderboard);

export default router;
