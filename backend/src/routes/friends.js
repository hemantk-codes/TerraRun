import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  followUser,
  unfollowUser,
  getFriendStatusHandler,
  searchUsers,
  listFriends,
} from '../controllers/friendController.js';

const router = Router();

router.use(requireAuth);

// Order matters: /search and /status/:userId must come before any bare
// "/:something" route would be added later, so Express doesn't try to
// match "search" or "status" as a :userId param.
router.get('/search', searchUsers);
router.get('/status/:userId', getFriendStatusHandler);
router.post('/follow/:userId', followUser);
router.post('/unfollow/:userId', unfollowUser);
router.get('/', listFriends);

export default router;
