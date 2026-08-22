import { Router } from 'express';
import {
  getNearbyTerritories,
  getMyPendingSplits, // Phase 7
  resolveSplit, // Phase 7
} from '../controllers/territoryController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// GET /api/territories/nearby?lat=<>&lng=<>&radius=<meters>
// Public — see the DESIGN NOTE in territoryController.js.
router.get('/nearby', getNearbyTerritories);

// GET /api/territories/pending-splits
// Phase 7 — auth required. Returns the current user's unresolved
// "territory_split" decisions for the frontend modal.
router.get('/pending-splits', requireAuth, getMyPendingSplits);

// POST /api/territories/:id/resolve-split
// Phase 7 — auth required. Body: { action: 'regenerate', placement } |
// { action: 'reclaim' }.
router.post('/:id/resolve-split', requireAuth, resolveSplit);

export default router;
