import { Request, Response } from 'express';
import asyncHandler from '../utils/asyncHandler';
import Team from '../models/Team';
import School from '../models/School';
import Event, { EventStatus } from '../models/Event';
import Match from '../models/Match';
import { TournamentStage } from '../models/Matchup';

// @desc    Register a team for a school
// @route   POST /api/v1/schools/:schoolId/teams
// @access  Private
export const registerTeam = asyncHandler(async (req: Request, res: Response) => {
  const { name, members } = req.body;
  const { schoolId } = req.params;
  const schoolIdStr = String(schoolId);

  if (!name) {
    res.status(400);
    throw new Error('Team name is required');
  }

  if (!Array.isArray(members) || members.length !== 3) {
    res.status(400);
    throw new Error('A team must have exactly 3 members');
  }

  for (const m of members) {
    if (!m.fullName || typeof m.fullName !== 'string') {
      res.status(400);
      throw new Error('Each member must have a fullName');
    }
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

  const teamCount = await Team.countDocuments({ school: schoolIdStr });
  if (teamCount >= 3) {
    res.status(400);
    throw new Error('Maximum of 3 teams per school reached');
  }

  // Auto-assign teamNumber as next available slot (1, 2, or 3)
  const existingNumbers = (await Team.find({ school: schoolIdStr }).distinct('teamNumber')) as number[];
  const teamNumber = ([1, 2, 3] as number[]).find((n) => !existingNumbers.includes(n))!;

  // Assign speakerOrder automatically
  const membersWithOrder = members.map((m: { fullName: string }, i: number) => ({
    fullName: m.fullName,
    speakerOrder: i + 1,
  }));

  const team = await Team.create({
    name,
    teamNumber,
    members: membersWithOrder,
    school: schoolIdStr,
    event: school.event,
  });

  res.status(201).json(team);
});

// @desc    Get all teams for a school
// @route   GET /api/v1/schools/:schoolId/teams
// @access  Public
export const getTeamsBySchool = asyncHandler(async (req: Request, res: Response) => {
  const teams = await Team.find({ school: req.params.schoolId });
  res.json(teams);
});

// @desc    Update a team (name or members)
// @route   PATCH /api/v1/schools/:schoolId/teams/:teamId
// @access  Private
export const updateTeam = asyncHandler(async (req: Request, res: Response) => {
  const team = await Team.findOne({ _id: req.params.teamId, school: req.params.schoolId });
  if (!team) {
    res.status(404);
    throw new Error('Team not found');
  }

  const event = await Event.findById(team.event);
  if (!event || (event.status !== EventStatus.REGISTRATION_OPEN && event.status !== EventStatus.DRAFT)) {
    res.status(400);
    throw new Error('Registration is not open for this event');
  }

  const { name, members } = req.body;
  if (name) team.name = name;
  if (members) {
    if (!Array.isArray(members) || members.length !== 3) {
      res.status(400);
      throw new Error('A team must have exactly 3 members');
    }
    team.members = members.map((m: { fullName: string }, i: number) => ({
      fullName: m.fullName,
      speakerOrder: i + 1,
    }));
  }

  const updated = await team.save();
  res.json(updated);
});

// @desc    Delete a team
// @route   DELETE /api/v1/schools/:schoolId/teams/:teamId
// @access  Private
export const deleteTeam = asyncHandler(async (req: Request, res: Response) => {
  const team = await Team.findOne({ _id: req.params.teamId, school: req.params.schoolId });
  if (!team) {
    res.status(404);
    throw new Error('Team not found');
  }

  const event = await Event.findById(team.event);
  if (!event || (event.status !== EventStatus.REGISTRATION_OPEN && event.status !== EventStatus.DRAFT)) {
    res.status(400);
    throw new Error('Cannot delete teams after registration has closed');
  }

  await team.deleteOne();
  res.json({ message: 'Team deleted' });
});

// @desc    Get all teams for an event sorted by points (Rankings)
// @route   GET /api/v1/events/:eventId/rankings
// @access  Public
export const getEventRankings = asyncHandler(async (req: Request, res: Response) => {
  const eventId = req.params.eventId;

  const teams = await Team.find({ event: eventId })
    .sort({ totalPoints: -1, matchesPlayed: 1 })
    .populate('school', 'name');

  const stageOrder: Record<string, number> = {
    [TournamentStage.PRELIMINARY]: 1,
    [TournamentStage.QUARTER_FINAL]: 2,
    [TournamentStage.SEMI_FINAL]: 3,
    [TournamentStage.FINAL]: 4,
  };

  const ranked = await Promise.all(teams.map(async (team, index) => {
    let furthestStage = 'Prelim';

    const matches = await Match.find({
      event: eventId,
      status: 'Completed',
      $or: [{ teamA: team._id }, { teamB: team._id }],
    }).select('stage winner');

    if (matches.length > 0) {
      const best = matches.reduce((prev, curr) =>
        (stageOrder[curr.stage] ?? 0) > (stageOrder[prev.stage] ?? 0) ? curr : prev
      );
      if (best.stage === TournamentStage.FINAL && best.winner?.toString() === team._id.toString()) {
        furthestStage = 'Champion';
      } else {
        furthestStage = best.stage;
      }
    }

    return {
      rank: index + 1,
      teamName: team.name,
      school: (team.school as any)?.name,
      totalPoints: team.totalPoints,
      matchesPlayed: team.matchesPlayed,
      matchesWon: team.matchesWon,
      furthestStage,
    };
  }));

  res.json(ranked);
});
