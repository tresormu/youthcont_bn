import express from 'express';
import { createEvent, getEvents, getEventById, updateEvent, updateEventStatus, rollbackEventStatus, deleteEvent } from '../controllers/eventController';
import { protect } from '../middleware/authMiddleware';

const router = express.Router();

router.route('/').get(getEvents).post(protect, createEvent);
router.route('/:id').get(getEventById).patch(protect, updateEvent).delete(protect, deleteEvent);
router.patch('/:id/status', protect, updateEventStatus);
router.patch('/:id/status/rollback', protect, rollbackEventStatus);

export default router;
