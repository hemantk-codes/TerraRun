import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { listConversations, getThread } from '../controllers/messageController.js';

const router = Router();

router.use(requireAuth);

router.get('/conversations', listConversations);
router.get('/thread/:otherUserId', getThread);

export default router;
