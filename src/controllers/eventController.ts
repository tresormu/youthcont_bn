import { Request, Response } from 'express';
import asyncHandler from '../utils/asyncHandler';
import Event, { EventStatus } from '../models/Event';
import School from '../models/School';
import Team from '../models/Team';
import PublicSpeaker from '../models/PublicSpeaker';
import Match from '../models/Match';
import Matchup from '../models/Matchup';

// Valid status transitions — enforces the SRS lifecycle
const VALID_TRANSITIONS: Record<EventStatus, EventStatus[]> = {
  [EventStatus.DRAFT]: [EventStatus.REGISTRATION_OPEN],
  [EventStatus.REGISTRATION_OPEN]: [EventStatus.PRELIMINARY_ROUNDS],
  [EventStatus.PRELIMINARY_ROUNDS]: [EventStatus.BRACKET_STAGE],
  [EventStatus.BRACKET_STAGE]: [EventStatus.COMPLETED],
  [EventStatus.COMPLETED]: [],
};

// @desc    Create a new event
// @route   POST /api/v1/events
// @access  Private
export const createEvent = asyncHandler(async (req: Request, res: Response) => {
  const { name, edition, description, date } = req.body;

  if (!name) {
    res.status(400);
    throw new Error('Event name is required');
  }

  const eventExists = await Event.findOne({ name });
  if (eventExists) {
    res.status(400);
    throw new Error('Event with this name already exists');
  }

  const event = await Event.create({
    name,
    edition,
    description,
    date: date ? new Date(date) : undefined,
    createdBy: req.user?._id,
  });

  res.status(201).json(event);
});

// @desc    Get all events
// @route   GET /api/v1/events
// @access  Public
export const getEvents = asyncHandler(async (_req: Request, res: Response) => {
  const events = await Event.find({}).populate('createdBy', 'name');
  res.json(events);
});

// @desc    Get event by ID
// @route   GET /api/v1/events/:id
// @access  Public
export const getEventById = asyncHandler(async (req: Request, res: Response) => {
  const event = await Event.findById(req.params.id).populate('createdBy', 'name');

  if (!event) {
    res.status(404);
    throw new Error('Event not found');
  }

  res.json(event);
});

// @desc    Update event details (name, edition, description)
// @route   PATCH /api/v1/events/:id
// @access  Private
export const updateEvent = asyncHandler(async (req: Request, res: Response) => {
  const event = await Event.findById(req.params.id);

  if (!event) {
    res.status(404);
    throw new Error('Event not found');
  }

  if (event.status === EventStatus.COMPLETED) {
    res.status(400);
    throw new Error('Cannot edit a completed event');
  }

  const { name, edition, description, date } = req.body;
  if (name) event.name = name;
  if (edition !== undefined) event.edition = edition;
  if (description !== undefined) event.description = description;
  if (date !== undefined) event.date = date ? new Date(date) : undefined;

  const updated = await event.save();
  res.json(updated);
});

// @desc    Advance event to next status
// @route   PATCH /api/v1/events/:id/status
// @access  Private
export const updateEventStatus = asyncHandler(async (req: Request, res: Response) => {
  const { status } = req.body;
  const event = await Event.findById(req.params.id);

  if (!event) {
    res.status(404);
    throw new Error('Event not found');
  }

  const allowed = VALID_TRANSITIONS[event.status];
  if (!allowed.includes(status)) {
    res.status(400);
    throw new Error(
      `Cannot transition from "${event.status}" to "${status}". Allowed: ${allowed.join(', ') || 'none'}`
    );
  }

  event.status = status;
  const updated = await event.save();
  res.json(updated);
});

// Valid reverse transitions
const REVERSE_TRANSITIONS: Partial<Record<EventStatus, EventStatus>> = {
  [EventStatus.REGISTRATION_OPEN]: EventStatus.DRAFT,
  [EventStatus.PRELIMINARY_ROUNDS]: EventStatus.REGISTRATION_OPEN,
};

// @desc    Roll back event to previous status (only safe stages)
// @route   PATCH /api/v1/events/:id/status/rollback
// @access  Private
export const rollbackEventStatus = asyncHandler(async (req: Request, res: Response) => {
  const event = await Event.findById(req.params.id);
  if (!event) {
    res.status(404);
    throw new Error('Event not found');
  }

  const previous = REVERSE_TRANSITIONS[event.status];
  if (!previous) {
    res.status(400);
    throw new Error(`Cannot roll back from "${event.status}"`);
  }

  event.status = previous;
  const updated = await event.save();
  res.json(updated);
});

// @desc    Delete an event and all associated data
// @route   DELETE /api/v1/events/:id
// @access  Private
export const deleteEvent = asyncHandler(async (req: Request, res: Response) => {
  const event = await Event.findById(req.params.id);

  if (!event) {
    res.status(404);
    throw new Error('Event not found');
  }

  const eventId = event._id;

  await Promise.all([
    Match.deleteMany({ event: eventId }),
    Matchup.deleteMany({ event: eventId }),
    Team.deleteMany({ event: eventId }),
    PublicSpeaker.deleteMany({ event: eventId }),
    School.deleteMany({ event: eventId }),
  ]);

  await event.deleteOne();
  res.json({ message: 'Event and all associated data deleted' });
});
