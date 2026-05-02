import { Request, Response } from 'express';
import asyncHandler from '../utils/asyncHandler';
import School from '../models/School';
import Team from '../models/Team';
import Match from '../models/Match';

import Event, { EventStatus } from '../models/Event';
import { emitToEvent } from '../socket';
import mongoose from 'mongoose';

// @desc    Register a school for an event
// @route   POST /api/v1/events/:eventId/schools
// @access  Private
export const registerSchool = asyncHandler(async (req: Request, res: Response) => {
  const { name, region, contactPerson, contactEmail, teams } = req.body;
  const { eventId } = req.params;
  const eventIdStr = String(eventId);

  if (!name) {
    res.status(400);
    throw new Error('School name is required');
  }

  // Validate teams if provided
  if (teams && Array.isArray(teams)) {
    for (const [i, team] of teams.entries()) {
      if (!team.name?.trim()) {
        res.status(400);
        throw new Error(`Team ${i + 1} name is required`);
      }
      if (!Array.isArray(team.members) || team.members.length !== 3 || team.members.some((m: any) => !m.fullName?.trim())) {
        res.status(400);
        throw new Error(`Team ${i + 1} must have exactly 3 members with full names`);
      }
    }
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

  // Create teams with members if provided
  if (teams && Array.isArray(teams) && teams.length > 0) {
    await Promise.all(teams.map((team: any, i: number) =>
      Team.create({
        name: team.name.trim(),
        teamNumber: i + 1,
        members: team.members.map((m: any, j: number) => ({ fullName: m.fullName.trim(), speakerOrder: j + 1 })),
        school: school._id,
        event: eventIdStr,
      })
    ));
  }

  const teamCount = teams && Array.isArray(teams) ? teams.length : 0;
  emitToEvent(eventIdStr, 'school:added', { ...school.toObject(), teamCount, publicSpeakerCount: 0, teams: [], publicSpeakers: [] });
  
  res.status(201).json(school);
});


// @desc    Get all schools for an event
// @route   GET /api/v1/events/:eventId/schools
// @access  Public
export const getSchoolsByEvent = asyncHandler(async (req: Request, res: Response) => {
  const eventId = String(req.params.eventId);
  const eventObjectId = new mongoose.Types.ObjectId(eventId);
  const schools = await School.aggregate([
    { $match: { event: eventObjectId } },
    {
      $lookup: {
        from: 'teams',
        localField: '_id',
        foreignField: 'school',
        as: 'teams',
      },
    },
    {
      $lookup: {
        from: 'publicspeakers',
        localField: '_id',
        foreignField: 'school',
        as: 'publicSpeakers',
      },
    },
    {
      $addFields: {
        teamCount: { $size: '$teams' },
        publicSpeakerCount: { $size: '$publicSpeakers' },
      },
    },
    { $sort: { name: 1 } },
  ]);
  res.json(schools);
});

// @desc    Get one school by ID
// @route   GET /api/v1/schools/:schoolId
// @access  Public
export const getSchoolById = asyncHandler(async (req: Request, res: Response) => {
  const school = await School.findById(req.params.schoolId);
  if (!school) {
    res.status(404);
    throw new Error('School not found');
  }
  res.json(school);
});


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

// @desc    Generate school report data
// @route   GET /api/v1/events/:eventId/schools/:schoolId/report
// @access  Public
export const getSchoolReport = asyncHandler(async (req: Request, res: Response) => {
  const { eventId, schoolId } = req.params;
  
  const school = await School.findById(schoolId);
  const event = await Event.findById(eventId);
  
  if (!school || !event) {
    res.status(404);
    throw new Error('School or Event not found');
  }

  const teams = await Team.find({ school: schoolId, event: eventId });
  const teamIds = teams.map(t => t._id);
  
  const matches = await Match.find({
    event: eventId,
    $or: [{ teamA: { $in: teamIds } }, { teamB: { $in: teamIds } }],
    status: 'Completed'
  });
  
  const speakerScores = await mongoose.model('SpeakerScore').find({
    event: eventId,
    matchId: { $in: matches.map(m => m._id) }
  });

  const reportTeams = teams.map(team => {
    let teamTotalPoints = team.totalPoints || 0;
    
    const members = team.members.map(member => {
      const memberScores = speakerScores.filter((s: any) => s.memberId.toString() === member._id?.toString());
      let round1 = 0, round2 = 0, round3 = 0;
      memberScores.forEach((s: any) => {
        if (s.roundNumber === 1) round1 = s.pointsScored;
        if (s.roundNumber === 2) round2 = s.pointsScored;
        if (s.roundNumber === 3) round3 = s.pointsScored;
      });
      return {
        name: member.fullName,
        role: 'Speaker',
        round1,
        round2,
        round3,
        totalPoints: member.totalSpeakerPoints || 0
      };
    });

    return {
      teamName: team.name,
      totalTeamPoints: teamTotalPoints,
      wins: team.matchesWon || 0,
      losses: (team.matchesPlayed || 0) - (team.matchesWon || 0),
      members
    };
  });

  const grandTotalPoints = reportTeams.reduce((sum, t) => sum + t.members.reduce((mSum, m) => mSum + m.totalPoints, 0), 0);

  res.json({
    schoolName: school.name,
    eventName: event.name,
    teams: reportTeams,
    grandTotalPoints
  });
});
