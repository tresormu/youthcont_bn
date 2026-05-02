import express from 'express';
import { registerSchool, getSchoolsByEvent, getSchoolById, updateSchool, deleteSchool, getSchoolReport } from '../controllers/schoolController';
import { registerTeam, getTeamsBySchool, updateTeam, deleteTeam, getEventRankings, updateTeamMembers, getTeamDetails } from '../controllers/teamController';
import { registerPublicSpeaker, getPublicSpeakersBySchool, deletePublicSpeaker } from '../controllers/publicSpeakerController';
import { protect } from '../middleware/authMiddleware';

const router = express.Router();

// Schools
router.route('/events/:eventId/schools').get(getSchoolsByEvent).post(protect, registerSchool);
router.route('/schools/:schoolId').get(getSchoolById);
router.route('/events/:eventId/schools/:schoolId').patch(protect, updateSchool).delete(protect, deleteSchool);
router.route('/events/:eventId/schools/:schoolId/report').get(getSchoolReport);

// Teams
router.route('/schools/:schoolId/teams').get(getTeamsBySchool).post(protect, registerTeam);
router.route('/schools/:schoolId/teams/:teamId').patch(protect, updateTeam).delete(protect, deleteTeam);
router.put('/teams/:teamId/members', protect, updateTeamMembers);

// Public Speakers
router.route('/schools/:schoolId/public-speakers').get(getPublicSpeakersBySchool).post(protect, registerPublicSpeaker);
router.route('/schools/:schoolId/public-speakers/:speakerId').delete(protect, deletePublicSpeaker);

// Rankings
router.get('/events/:eventId/rankings', getEventRankings);

// Team Details
router.get('/events/:eventId/teams/:teamId/details', getTeamDetails);

export default router;
