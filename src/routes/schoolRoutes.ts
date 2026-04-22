import express from 'express';
import { registerSchool, getSchoolsByEvent, updateSchool, deleteSchool } from '../controllers/schoolController';
import { registerTeam, getTeamsBySchool, updateTeam, deleteTeam, getEventRankings } from '../controllers/teamController';
import { registerPublicSpeaker, getPublicSpeakersBySchool, deletePublicSpeaker } from '../controllers/publicSpeakerController';
import { exportRankingsExcel } from '../controllers/exportController';
import { protect } from '../middleware/authMiddleware';

const router = express.Router();

// Schools
router.route('/events/:eventId/schools').get(getSchoolsByEvent).post(protect, registerSchool);
router.route('/events/:eventId/schools/:schoolId').patch(protect, updateSchool).delete(protect, deleteSchool);

// Teams
router.route('/schools/:schoolId/teams').get(getTeamsBySchool).post(protect, registerTeam);
router.route('/schools/:schoolId/teams/:teamId').patch(protect, updateTeam).delete(protect, deleteTeam);

// Public Speakers
router.route('/schools/:schoolId/public-speakers').get(getPublicSpeakersBySchool).post(protect, registerPublicSpeaker);
router.route('/schools/:schoolId/public-speakers/:speakerId').delete(protect, deletePublicSpeaker);

// Rankings & Export
router.get('/events/:eventId/rankings', getEventRankings);
router.get('/events/:eventId/rankings/excel', protect, exportRankingsExcel);

export default router;
