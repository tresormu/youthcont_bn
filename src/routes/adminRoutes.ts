import express from 'express';
import { createStaff } from '../controllers/adminController';
import { protect, adminOnly } from '../middleware/authMiddleware';

const router = express.Router();

router.use(protect, adminOnly);

router.post('/staff', createStaff);

export default router;
