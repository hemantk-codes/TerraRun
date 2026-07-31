import { Router } from 'express';
import { signupEmail, loginEmail, phoneAuth, refresh, logout } from '../controllers/authController.js';

const router = Router();

router.post('/signup/email', signupEmail);
router.post('/login/email', loginEmail);
router.post('/phone', phoneAuth); // handles both signup and login for phone users
router.post('/refresh', refresh);
router.post('/logout', logout);

export default router;
