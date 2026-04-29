import express from 'express';
import { createStaff } from '../controllers/adminController';
import { generateSchoolAccess, revokeSchoolAccess } from '../controllers/schoolAccessController';
import { protect, adminOnly } from '../middleware/authMiddleware';

const router = express.Router();

router.use(protect, adminOnly);

router.post('/staff', createStaff);
router.post('/school-access/generate', generateSchoolAccess);
router.delete('/school-access/:accessCode', revokeSchoolAccess);

export default router;
