import { Router } from 'express';
import { getMe, updateMe } from '../controllers/profileController.js';
import { getDashboard } from '../controllers/profileDashboardController.js';
import { requireAuth } from '../middleware/auth.js';
import { uploadAvatar } from '../controllers/avatarController.js'
import upload from '../middleware/avatarUpload.js'

const router = Router();

// Visual profile dashboard — live aggregates from Activity/Territory/User/Notification.
// Keep this before any future generic '/:id' routes if those are added later.
router.get('/dashboard', requireAuth, getDashboard);

// Existing Phase 1 profile endpoints.
router.get('/me', requireAuth, getMe);
router.patch('/me', requireAuth, updateMe);

router.post('/avatar', requireAuth, upload.single('avatar'), uploadAvatar);

export default router;
