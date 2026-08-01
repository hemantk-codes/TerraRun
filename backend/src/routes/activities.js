import { Router } from 'express';
import { createActivity } from '../controllers/activityController.js';

// ⚠️ INTEGRATION ASSUMPTION (Phase 1 dependency): this session didn't have
// your actual Phase 1 auth middleware file in context, so this import
// guesses at the conventional path/name from the Phase 1 prompt
// ("Middleware to protect routes using the access token"). If your real
// file lives elsewhere or exports a differently-named function (e.g.
// `requireAuth` instead of `protect`), update this one line — everything
// else in this route/controller only cares that `req.user` (or `req.userId`)
// ends up set before createActivity runs.
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.post('/', requireAuth, createActivity);

export default router;
