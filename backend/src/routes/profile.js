import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getMe, updateMe } from '../controllers/profileController.js';

const router = Router();

router.use(requireAuth);
router.get('/me', getMe);
router.patch('/me', updateMe);

export default router;
