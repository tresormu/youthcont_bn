import express from 'express';
import { getStaff, updateStaff, deactivateStaff } from '../controllers/staffController';
import { protect, adminOnly } from '../middleware/authMiddleware';

const router = express.Router();

router.use(protect, adminOnly);

router.get('/', getStaff);
router.route('/:id').patch(updateStaff).delete(deactivateStaff);

export default router;
