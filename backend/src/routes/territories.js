import { Router } from 'express';
import { getNearbyTerritories } from '../controllers/territoryController.js';

const router = Router();

// GET /api/territories/nearby?lat=<>&lng=<>&radius=<meters>
router.get('/nearby', getNearbyTerritories);

export default router;
