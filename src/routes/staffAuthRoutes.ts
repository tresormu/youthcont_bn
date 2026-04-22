import express from 'express';
import { staffLogin, staffLogout, staffVerifyPin, staffChangePassword } from '../controllers/staffAuthController';
import { protect } from '../middleware/authMiddleware';

const router = express.Router();

router.post('/login', staffLogin);
router.post('/verify-pin', staffVerifyPin);
router.post('/logout', protect, staffLogout);
router.patch('/change-password', protect, staffChangePassword);

export default router;
