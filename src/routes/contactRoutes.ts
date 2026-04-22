import express from 'express';
import { submitContact, getContacts, updateContactStatus } from '../controllers/contactController';
import { protect, adminOnly } from '../middleware/authMiddleware';

const router = express.Router();

router.post('/', submitContact);
router.get('/', protect, adminOnly, getContacts);
router.patch('/:id/status', protect, adminOnly, updateContactStatus);

export default router;
