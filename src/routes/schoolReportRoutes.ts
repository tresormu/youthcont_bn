import express from 'express';
import { schoolOwnerLogin, getSchoolReportDashboard } from '../controllers/schoolAccessController';
import { exportSchoolReportPDF } from '../controllers/exportController';
import { schoolOwnerAuth } from '../middleware/authMiddleware';

const router = express.Router();

router.post('/login', schoolOwnerLogin);
router.get('/dashboard', schoolOwnerAuth, getSchoolReportDashboard);
router.get('/export/pdf', schoolOwnerAuth, exportSchoolReportPDF);

export default router;
