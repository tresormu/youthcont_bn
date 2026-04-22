import { Request, Response } from 'express';
import asyncHandler from '../utils/asyncHandler';
import School from '../models/School';
import Event, { EventStatus } from '../models/Event';

// @desc    Register a school for an event
// @route   POST /api/v1/events/:eventId/schools
// @access  Private
export const registerSchool = asyncHandler(async (req: Request, res: Response) => {
  const { name, region, contactPerson, contactEmail } = req.body;
  const { eventId } = req.params;
  const eventIdStr = String(eventId);

  if (!name) {
    res.status(400);
    throw new Error('School name is required');
  }

  const event = await Event.findById(eventIdStr);
  if (!event) {
    res.status(404);
    throw new Error('Event not found');
  }

  if (event.status !== EventStatus.REGISTRATION_OPEN && event.status !== EventStatus.DRAFT) {
    res.status(400);
    throw new Error('Registration is not open for this event');
  }

  const schoolExists = await School.findOne({ name, event: eventIdStr });
  if (schoolExists) {
    res.status(400);
    throw new Error('School already registered for this event');
  }

  const school = await School.create({ name, region, contactPerson, contactEmail, event: eventIdStr });
  res.status(201).json(school);
});

// @desc    Get all schools for an event
// @route   GET /api/v1/events/:eventId/schools
// @access  Public
export const getSchoolsByEvent = asyncHandler(async (req: Request, res: Response) => {
  const schools = await School.find({ event: req.params.eventId }).sort({ name: 1 });
  res.json(schools);
});

// @desc    Update a school
// @route   PATCH /api/v1/events/:eventId/schools/:schoolId
// @access  Private
export const updateSchool = asyncHandler(async (req: Request, res: Response) => {
  const school = await School.findOne({ _id: req.params.schoolId, event: req.params.eventId });
  if (!school) {
    res.status(404);
    throw new Error('School not found');
  }

  const { name, region, contactPerson, contactEmail } = req.body;
  if (name) school.name = name;
  if (region !== undefined) school.region = region;
  if (contactPerson !== undefined) school.contactPerson = contactPerson;
  if (contactEmail !== undefined) school.contactEmail = contactEmail;

  const updated = await school.save();
  res.json(updated);
});

// @desc    Remove a school from an event
// @route   DELETE /api/v1/events/:eventId/schools/:schoolId
// @access  Private
export const deleteSchool = asyncHandler(async (req: Request, res: Response) => {
  const school = await School.findOne({ _id: req.params.schoolId, event: req.params.eventId });
  if (!school) {
    res.status(404);
    throw new Error('School not found');
  }

  const event = await Event.findById(req.params.eventId);
  if (!event || (event.status !== EventStatus.REGISTRATION_OPEN && event.status !== EventStatus.DRAFT)) {
    res.status(400);
    throw new Error('Cannot remove schools after registration has closed');
  }

  await school.deleteOne();
  res.json({ message: 'School removed from event' });
});
