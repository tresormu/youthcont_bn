import express from 'express';
import {
  createMatchup,
  createMatchesForMatchup,
  enterMatchResult,
  updateMatchPairing,
  getEventMatchups,
  getMatchupMatches,
  autoAssignMatchups,
  manualAssignTeam,
  generateBracket,
  getEventBracket,
  cancelMatchup,
  voidMatchResult,
  cancelPreliminaryMatchups,
  cancelBracket,
} from '../controllers/matchController';
import { exportRankingsPDF, exportRankingsExcel } from '../controllers/exportController';
import { protect } from '../middleware/authMiddleware';

const router = express.Router();

router.route('/events/:eventId/matchups').get(getEventMatchups).post(protect, createMatchup);
router.post('/events/:eventId/matchups/manual', protect, manualAssignTeam);
router.post('/events/:eventId/matchups/auto', protect, autoAssignMatchups);
router.delete('/events/:eventId/matchups/preliminary', protect, cancelPreliminaryMatchups);
router.get('/events/:eventId/bracket', getEventBracket);
router.get('/events/:eventId/rankings/pdf', protect, exportRankingsPDF);
router.get('/events/:eventId/rankings/excel', protect, exportRankingsExcel);
router.post('/events/:eventId/bracket/generate', protect, generateBracket);
router.delete('/events/:eventId/bracket', protect, cancelBracket);

router.route('/matchups/:matchupId/matches').get(getMatchupMatches).post(protect, createMatchesForMatchup);
router.delete('/matchups/:matchupId', protect, cancelMatchup);
router.patch('/matches/:id/result', protect, enterMatchResult);
router.patch('/matches/:id/pairing', protect, updateMatchPairing);
router.patch('/matches/:id/void', protect, voidMatchResult);

export default router
