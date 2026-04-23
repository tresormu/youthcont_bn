import { Request, Response } from 'express';
import asyncHandler from '../utils/asyncHandler';
import ContactMessage, { ContactReason, ContactStatus } from '../models/ContactMessage';
import { sendContactNotification, sendContactConfirmation } from '../utils/sendEmail';

// @desc    Submit a contact message (public)
// @route   POST /api/v1/contact
// @access  Public
export const submitContact = asyncHandler(async (req: Request, res: Response) => {
  const { email, phone, reason, message } = req.body;

  if (!email || !phone || !reason || !message) {
    res.status(400);
    throw new Error('email, phone, reason, and message are all required');
  }

  if (typeof phone !== 'string' || phone.length > 20) {
    res.status(400);
    throw new Error('phone must be a string of at most 20 characters');
  }

  if (typeof message !== 'string' || message.length > 2000) {
    res.status(400);
    throw new Error('message must be at most 2000 characters');
  }

  if (!Object.values(ContactReason).includes(reason)) {
    res.status(400);
    throw new Error(`Invalid reason. Valid options: ${Object.values(ContactReason).join(', ')}`);
  }

  const contact = await ContactMessage.create({ email, phone, reason, message });

  // Fire emails in background — don't let delivery failures affect the user response
  Promise.all([
    sendContactNotification({ email, phone, reason, message }),
    sendContactConfirmation({ email, reason }),
  ]).catch((err) => console.error('[sendEmail] contact email failed:', err));

  res.status(201).json({ message: 'Your message has been received. We will get back to you shortly.', id: contact._id });
});

// @desc    Get all contact messages
// @route   GET /api/v1/contact
// @access  Seed Admin only
export const getContacts = asyncHandler(async (req: Request, res: Response) => {
  const { status } = req.query;

  const filter = status ? { status: status as ContactStatus } : {};
  const contacts = await ContactMessage.find(filter).sort({ createdAt: -1 });

  res.json(contacts);
});

// @desc    Update contact message status (read / resolved)
// @route   PATCH /api/v1/contact/:id/status
// @access  Seed Admin only
export const updateContactStatus = asyncHandler(async (req: Request, res: Response) => {
  const { status } = req.body;

  if (!status || !Object.values(ContactStatus).includes(status)) {
    res.status(400);
    throw new Error(`Invalid status. Valid options: ${Object.values(ContactStatus).join(', ')}`);
  }

  const contact = await ContactMessage.findByIdAndUpdate(
    req.params.id,
    { status },
    { new: true }
  );

  if (!contact) {
    res.status(404);
    throw new Error('Contact message not found');
  }

  res.json(contact);
});
