import { Request, Response } from 'express';
import asyncHandler from '../utils/asyncHandler';
import Matchup, { TournamentStage } from '../models/Matchup';
import Match, { MatchStatus } from '../models/Match';
import Team from '../models/Team';
import School from '../models/School';
import Event, { EventStatus } from '../models/Event';
import { emitToEvent } from '../socket';

// @desc    Create a school matchup manually
// @route   POST /api/v1/events/:eventId/matchups
// @access  Private
export const createMatchup = asyncHandler(async (req: Request, res: Response) => {
  const { schoolAId, schoolBId, stage } = req.body;
  const { eventId } = req.params;

  if (!schoolAId) {
    res.status(400);
    throw new Error('schoolAId is required');
  }

  const event = await Event.findById(eventId);
  if (!event) {
    res.status(404);
    throw new Error('Event not found');
  }

  const matchup = await Matchup.create({
    event: String(eventId),
    schoolA: String(schoolAId),
    schoolB: schoolBId ? String(schoolBId) : undefined,
    stage: stage || TournamentStage.PRELIMINARY,
  });

  emitToEvent(String(eventId), 'matchups:created', { matchups: [matchup] });

  res.status(201).json(matchup);
});

// @desc    Create individual team-vs-team match for a matchup
// @route   POST /api/v1/matchups/:matchupId/matches
// @access  Private
export const createMatchesForMatchup = asyncHandler(async (req: Request, res: Response) => {
  const { teamAId, teamBId } = req.body;
  const { matchupId } = req.params;

  if (!teamAId) {
    res.status(400);
    throw new Error('teamAId is required');
  }

  const matchup = await Matchup.findById(matchupId);
  if (!matchup) {
    res.status(404);
    throw new Error('Matchup not found');
  }

  const match = await Match.create({
    matchup: String(matchupId),
    event: matchup.event,
    teamA: String(teamAId),
    teamB: teamBId ? String(teamBId) : undefined,
    stage: matchup.stage,
    status: MatchStatus.PENDING,
  });

  res.status(201).json(match);
});

// @desc    Enter or correct a match result
// @route   PATCH /api/v1/matches/:id/result
// @access  Private
export const enterMatchResult = asyncHandler(async (req: Request, res: Response) => {
  const { winnerId } = req.body;

  if (!winnerId) {
    res.status(400);
    throw new Error('winnerId is required');
  }

  const match = await Match.findById(req.params.id);
  if (!match) {
    res.status(404);
    throw new Error('Match not found');
  }

  const validTeams = [match.teamA?.toString(), match.teamB?.toString()].filter(Boolean);
  if (!validTeams.includes(winnerId.toString())) {
    res.status(400);
    throw new Error('Winner must be one of the two teams in this match');
  }

  const isCorrection = match.status === MatchStatus.COMPLETED && match.winner;

  if (isCorrection) {
    const previousWinnerId = match.winner!.toString();
    const previousLoserId = validTeams.find((id) => id !== previousWinnerId);

    await Team.findByIdAndUpdate(previousWinnerId, {
      $inc: { totalPoints: -3, matchesWon: -1, matchesPlayed: -1 },
    });
    if (previousLoserId) {
      await Team.findByIdAndUpdate(previousLoserId, { $inc: { matchesPlayed: -1 } });
    }
  }

  const newLoserId = validTeams.find((id) => id !== String(winnerId));

  await Team.findByIdAndUpdate(String(winnerId), {
    $inc: { totalPoints: 3, matchesWon: 1, matchesPlayed: 1 },
  });
  if (newLoserId) {
    await Team.findByIdAndUpdate(newLoserId, { $inc: { matchesPlayed: 1 } });
  }

  match.winner = winnerId;
  match.status = MatchStatus.COMPLETED;
  match.scoredBy = req.user?._id as any;
  match.scoredAt = new Date();
  await match.save();

  emitToEvent(match.event.toString(), 'match:updated', match);

  // Check for bracket advancement
  if ([TournamentStage.QUARTER_FINAL, TournamentStage.SEMI_FINAL, TournamentStage.FINAL].includes(match.stage)) {
    await checkAndAdvanceBracket(match.event.toString(), match.stage);
  }

  res.json(match);
});

// Helper to advance bracket stages automatically
async function checkAndAdvanceBracket(eventId: string, currentStage: TournamentStage) {
  const matches = await Match.find({ event: eventId, stage: currentStage });
  const allCompleted = matches.every((m) => m.status === MatchStatus.COMPLETED);

  if (!allCompleted) return;

  const event = await Event.findById(eventId);
  if (!event) return;

  if (currentStage === TournamentStage.QUARTER_FINAL) {
    const sfExists = await Match.exists({ event: eventId, stage: TournamentStage.SEMI_FINAL });
    if (sfExists) return;

    const pairings = [[0, 3], [1, 2]];

    for (let i = 0; i < pairings.length; i++) {
      const matchA = matches.find((m) => m.bracketSlot === pairings[i][0]);
      const matchB = matches.find((m) => m.bracketSlot === pairings[i][1]);

      if (matchA?.winner && matchB?.winner) {
        const teamA = await Team.findById(matchA.winner);
        const teamB = await Team.findById(matchB.winner);

        if (!teamA || !teamB) {
          console.error(`[bracket] QF->SF: could not find teams for slot ${i}`);
          continue;
        }

        const matchup = await Matchup.create({
          event: eventId,
          schoolA: teamA.school as any,
          schoolB: teamB.school as any,
          stage: TournamentStage.SEMI_FINAL,
          bracketSlot: i,
        });

        await Match.create({
          matchup: matchup._id as any,
          event: eventId,
          teamA: teamA._id as any,
          teamB: teamB._id as any,
          stage: TournamentStage.SEMI_FINAL,
          bracketSlot: i,
          status: MatchStatus.PENDING,
        });
      }
    }

    event.status = EventStatus.BRACKET_STAGE;
    await event.save();

    const sfMatches = await Match.find({ event: eventId, stage: TournamentStage.SEMI_FINAL })
      .populate('teamA', 'name')
      .populate('teamB', 'name');
    emitToEvent(eventId, 'bracket:updated', { stage: TournamentStage.SEMI_FINAL, matches: sfMatches });
    emitToEvent(eventId, 'event:statusChanged', { status: event.status });

  } else if (currentStage === TournamentStage.SEMI_FINAL) {
    const finalExists = await Match.exists({ event: eventId, stage: TournamentStage.FINAL });
    if (finalExists) return;

    const matchA = matches.find((m) => m.bracketSlot === 0);
    const matchB = matches.find((m) => m.bracketSlot === 1);

    if (matchA?.winner && matchB?.winner) {
      const teamA = await Team.findById(matchA.winner);
      const teamB = await Team.findById(matchB.winner);

      if (!teamA || !teamB) {
        console.error('[bracket] SF->Final: could not find teams');
        return;
      }

      const matchup = await Matchup.create({
        event: eventId,
        schoolA: teamA.school as any,
        schoolB: teamB.school as any,
        stage: TournamentStage.FINAL,
        bracketSlot: 0,
      });

      await Match.create({
        matchup: matchup._id as any,
        event: eventId,
        teamA: teamA._id as any,
        teamB: teamB._id as any,
        stage: TournamentStage.FINAL,
        bracketSlot: 0,
        status: MatchStatus.PENDING,
      });

      const finalMatch = await Match.findOne({ event: eventId, stage: TournamentStage.FINAL })
        .populate('teamA', 'name')
        .populate('teamB', 'name');
      emitToEvent(eventId, 'bracket:updated', { stage: TournamentStage.FINAL, matches: [finalMatch] });
    }

  } else if (currentStage === TournamentStage.FINAL) {
    event.status = EventStatus.COMPLETED;
    await event.save();
    emitToEvent(eventId, 'event:statusChanged', { status: event.status });
  }
}

// @desc    Auto-assign preliminary school matchups
// @route   POST /api/v1/events/:eventId/matchups/auto
// @access  Private
export const autoAssignMatchups = asyncHandler(async (req: Request, res: Response) => {
  const { eventId } = req.params;

  const event = await Event.findById(eventId);
  if (!event || event.status !== EventStatus.PRELIMINARY_ROUNDS) {
    res.status(400);
    throw new Error('Event must be in Preliminary Rounds stage to auto-assign matchups');
  }

  const schools = await School.find({ event: eventId });
  if (schools.length < 2) {
    res.status(400);
    throw new Error('At least 2 schools are required to assign matchups');
  }

  const shuffled = [...schools].sort(() => Math.random() - 0.5);
  const matchupsCreated: any[] = [];
  const byeSchools: string[] = [];

  for (let i = 0; i < shuffled.length; i += 2) {
    const schoolA = shuffled[i];
    const schoolB = shuffled[i + 1];

    if (!schoolB) {
      byeSchools.push(schoolA.name);
      continue;
    }

    const matchup = await Matchup.create({
      event: String(eventId),
      schoolA: schoolA._id as any,
      schoolB: schoolB._id as any,
      stage: TournamentStage.PRELIMINARY,
    });

    const teamsA = await Team.find({ school: schoolA._id, event: String(eventId) });
    const teamsB = await Team.find({ school: schoolB._id, event: String(eventId) });
    const pairCount = Math.min(teamsA.length, teamsB.length);
    const unmatchedA = teamsA.length - pairCount;
    const unmatchedB = teamsB.length - pairCount;

    for (let j = 0; j < pairCount; j++) {
      await Match.create({
        matchup: matchup._id as any,
        event: String(eventId),
        teamA: teamsA[j]._id as any,
        teamB: teamsB[j]._id as any,
        stage: TournamentStage.PRELIMINARY,
        status: MatchStatus.PENDING,
      });
    }

    matchupsCreated.push({
      ...matchup.toObject(),
      ...(unmatchedA > 0 && { unmatchedTeamsA: unmatchedA }),
      ...(unmatchedB > 0 && { unmatchedTeamsB: unmatchedB }),
    });
  }

  const response = {
    matchups: matchupsCreated,
    ...(byeSchools.length > 0 && { byeSchools, notice: 'Some schools received a bye due to odd count' }),
  };

  emitToEvent(String(eventId), 'matchups:created', response);

  res.status(201).json(response);
});

// @desc    Generate Power 8 bracket — staff pick teams or auto-select top 8 by points
// @route   POST /api/v1/events/:eventId/bracket/generate
// @access  Private
export const generateBracket = asyncHandler(async (req: Request, res: Response) => {
  const { eventId } = req.params;
  const { teamIds } = req.body;

  const event = await Event.findById(eventId);
  if (!event || event.status !== EventStatus.PRELIMINARY_ROUNDS) {
    res.status(400);
    throw new Error('Event must be in Preliminary Rounds stage to generate the bracket');
  }

  let teams: Awaited<ReturnType<typeof Team.find>>;

  if (teamIds) {
    if (!Array.isArray(teamIds) || teamIds.length !== 8) {
      res.status(400);
      throw new Error('teamIds must be an array of exactly 8 team IDs');
    }
    const found = await Team.find({ _id: { $in: teamIds }, event: eventId });
    if (found.length !== 8) {
      res.status(400);
      throw new Error('One or more teamIds are invalid or do not belong to this event');
    }
    teams = teamIds.map((id: string) => found.find((t) => t._id.toString() === id)!);
  } else {
    teams = await Team.find({ event: eventId })
      .sort({ totalPoints: -1, matchesPlayed: 1 })
      .limit(8);
    if (teams.length < 8) {
      res.status(400);
      throw new Error(`Not enough teams to form Power 8 — only ${teams.length} teams found`);
    }
  }

  const seeds = [
    [teams[0], teams[7]],
    [teams[1], teams[6]],
    [teams[2], teams[5]],
    [teams[3], teams[4]],
  ];

  const matchups: any[] = [];

  for (let i = 0; i < seeds.length; i++) {
    const [teamA, teamB] = seeds[i];
    const matchup = await Matchup.create({
      event: String(eventId),
      schoolA: teamA.school as any,
      schoolB: teamB.school as any,
      stage: TournamentStage.QUARTER_FINAL,
      bracketSlot: i,
    });

    await Match.create({
      matchup: matchup._id as any,
      event: String(eventId),
      teamA: teamA._id as any,
      teamB: teamB._id as any,
      stage: TournamentStage.QUARTER_FINAL,
      bracketSlot: i,
      status: MatchStatus.PENDING,
    });

    matchups.push(matchup);
  }

  event.status = EventStatus.BRACKET_STAGE;
  await event.save();

  const power8 = teams.map((t) => ({ id: t._id, name: t.name, points: t.totalPoints }));

  emitToEvent(String(eventId), 'bracket:generated', { matchups, power8 });
  emitToEvent(String(eventId), 'event:statusChanged', { status: event.status });

  res.status(201).json({ matchups, power8 });
});

// @desc    Cancel a matchup and its matches (only if no results entered)
// @route   DELETE /api/v1/matchups/:matchupId
// @access  Private
export const cancelMatchup = asyncHandler(async (req: Request, res: Response) => {
  const matchup = await Matchup.findById(req.params.matchupId);
  if (!matchup) {
    res.status(404);
    throw new Error('Matchup not found');
  }

  const hasResults = await Match.exists({ matchup: matchup._id, status: MatchStatus.COMPLETED });
  if (hasResults) {
    res.status(400);
    throw new Error('Cannot cancel a matchup that already has completed matches');
  }

  await Match.deleteMany({ matchup: matchup._id });
  await matchup.deleteOne();
  res.json({ message: 'Matchup and its matches cancelled' });
});

// @desc    Void a match result (revert to Pending and reverse team stats)
// @route   PATCH /api/v1/matches/:id/void
// @access  Private
export const voidMatchResult = asyncHandler(async (req: Request, res: Response) => {
  const match = await Match.findById(req.params.id);
  if (!match) {
    res.status(404);
    throw new Error('Match not found');
  }

  if (match.status !== MatchStatus.COMPLETED || !match.winner) {
    res.status(400);
    throw new Error('Match has no result to void');
  }

  const winnerId = match.winner.toString();
  const loserId = [match.teamA?.toString(), match.teamB?.toString()].find((id) => id && id !== winnerId);

  await Team.findByIdAndUpdate(winnerId, { $inc: { totalPoints: -3, matchesWon: -1, matchesPlayed: -1 } });
  if (loserId) await Team.findByIdAndUpdate(loserId, { $inc: { matchesPlayed: -1 } });

  match.winner = undefined;
  match.status = MatchStatus.PENDING;
  match.scoredBy = undefined;
  match.scoredAt = undefined;
  await match.save();

  emitToEvent(match.event.toString(), 'match:updated', match);

  res.json({ message: 'Match result voided', match });
});

// @desc    Cancel all preliminary matchups for an event (reset to re-assign)
// @route   DELETE /api/v1/events/:eventId/matchups/preliminary
// @access  Private
export const cancelPreliminaryMatchups = asyncHandler(async (req: Request, res: Response) => {
  const { eventId } = req.params;

  const event = await Event.findById(eventId);
  if (!event || event.status !== EventStatus.PRELIMINARY_ROUNDS) {
    res.status(400);
    throw new Error('Event must be in Preliminary Rounds stage to cancel matchups');
  }

  const hasResults = await Match.exists({ event: eventId, stage: TournamentStage.PRELIMINARY, status: MatchStatus.COMPLETED });
  if (hasResults) {
    res.status(400);
    throw new Error('Cannot cancel — some preliminary matches already have results');
  }

  await Match.deleteMany({ event: eventId, stage: TournamentStage.PRELIMINARY });
  await Matchup.deleteMany({ event: eventId, stage: TournamentStage.PRELIMINARY });

  res.json({ message: 'All preliminary matchups cancelled. You may re-assign.' });
});

// @desc    Cancel bracket generation (revert event to Preliminary Rounds)
// @route   DELETE /api/v1/events/:eventId/bracket
// @access  Private
export const cancelBracket = asyncHandler(async (req: Request, res: Response) => {
  const { eventId } = req.params;

  const event = await Event.findById(eventId);
  if (!event || event.status !== EventStatus.BRACKET_STAGE) {
    res.status(400);
    throw new Error('Event must be in Bracket Stage to cancel the bracket');
  }

  const bracketStages = [TournamentStage.QUARTER_FINAL, TournamentStage.SEMI_FINAL, TournamentStage.FINAL];

  const hasResults = await Match.exists({ event: eventId, stage: { $in: bracketStages }, status: MatchStatus.COMPLETED });
  if (hasResults) {
    res.status(400);
    throw new Error('Cannot cancel bracket — some bracket matches already have results');
  }

  await Match.deleteMany({ event: eventId, stage: { $in: bracketStages } });
  await Matchup.deleteMany({ event: eventId, stage: { $in: bracketStages } });

  event.status = EventStatus.PRELIMINARY_ROUNDS;
  await event.save();

  emitToEvent(String(eventId), 'event:statusChanged', { status: event.status });

  res.json({ message: 'Bracket cancelled. Event reverted to Preliminary Rounds.' });
});

// @desc    Get all matchups for an event
// @route   GET /api/v1/events/:eventId/matchups
// @access  Public
export const getEventMatchups = asyncHandler(async (req: Request, res: Response) => {
  const matchups = await Matchup.find({ event: req.params.eventId })
    .populate('schoolA', 'name')
    .populate('schoolB', 'name');
  res.json(matchups);
});

// @desc    Get all matches for a matchup
// @route   GET /api/v1/matchups/:matchupId/matches
// @access  Public
export const getMatchupMatches = asyncHandler(async (req: Request, res: Response) => {
  const matches = await Match.find({ matchup: req.params.matchupId })
    .populate('teamA', 'name')
    .populate('teamB', 'name')
    .populate('winner', 'name')
    .populate('scoredBy', 'name');
  res.json(matches);
});

// @desc    Get bracket data for an event
// @route   GET /api/v1/events/:eventId/bracket
// @access  Public
export const getEventBracket = asyncHandler(async (req: Request, res: Response) => {
  const stages = [TournamentStage.QUARTER_FINAL, TournamentStage.SEMI_FINAL, TournamentStage.FINAL];

  const bracket: Record<string, any[]> = {};

  for (const stage of stages) {
    const matches = await Match.find({ event: req.params.eventId, stage })
      .populate('teamA', 'name totalPoints')
      .populate('teamB', 'name totalPoints')
      .populate('winner', 'name');
    bracket[stage] = matches;
  }

  res.json(bracket);
});
