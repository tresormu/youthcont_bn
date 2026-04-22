import { Request, Response } from 'express';
import asyncHandler from '../utils/asyncHandler';
import PublicSpeaker from '../models/PublicSpeaker';
import School from '../models/School';
import Event, { EventStatus } from '../models/Event';

// @desc    Register a public speaker for a school
// @route   POST /api/v1/schools/:schoolId/public-speakers
// @access  Private
export const registerPublicSpeaker = asyncHandler(async (req: Request, res: Response) => {
  const { fullName } = req.body;
  const { schoolId } = req.params;
  const schoolIdStr = String(schoolId);

  if (!fullName) {
    res.status(400);
    throw new Error('fullName is required');
  }

  const school = await School.findById(schoolIdStr);
  if (!school) {
    res.status(404);
    throw new Error('School not found');
  }

  const event = await Event.findById(school.event);
  if (!event || (event.status !== EventStatus.REGISTRATION_OPEN && event.status !== EventStatus.DRAFT)) {
    res.status(400);
    throw new Error('Registration is not open for this event');
  }

  const speakerCount = await PublicSpeaker.countDocuments({ school: schoolIdStr });
  if (speakerCount >= 5) {
    res.status(400);
    throw new Error('Maximum of 5 public speakers per school reached');
  }

  // Auto-assign next available speakerNumber
  const existing = (await PublicSpeaker.find({ school: schoolIdStr }).distinct('speakerNumber')) as number[];
  const speakerNumber = ([1, 2, 3, 4, 5] as number[]).find((n) => !existing.includes(n))!;

  const speaker = await PublicSpeaker.create({
    fullName,
    speakerNumber,
    school: schoolIdStr,
    event: school.event,
  });

  res.status(201).json(speaker);
});

// @desc    Get all public speakers for a school
// @route   GET /api/v1/schools/:schoolId/public-speakers
// @access  Public
export const getPublicSpeakersBySchool = asyncHandler(async (req: Request, res: Response) => {
  const speakers = await PublicSpeaker.find({ school: req.params.schoolId }).sort({ speakerNumber: 1 });
  res.json(speakers);
});

// @desc    Delete a public speaker
// @route   DELETE /api/v1/schools/:schoolId/public-speakers/:speakerId
// @access  Private
export const deletePublicSpeaker = asyncHandler(async (req: Request, res: Response) => {
  const speaker = await PublicSpeaker.findOne({
    _id: req.params.speakerId,
    school: req.params.schoolId,
  });

  if (!speaker) {
    res.status(404);
    throw new Error('Public speaker not found');
  }

  const event = await Event.findById(speaker.event);
  if (!event || (event.status !== EventStatus.REGISTRATION_OPEN && event.status !== EventStatus.DRAFT)) {
    res.status(400);
    throw new Error('Cannot delete speakers after registration has closed');
  }

  await speaker.deleteOne();
  res.json({ message: 'Public speaker removed' });
});
