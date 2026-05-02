import { Request, Response } from 'express';
import asyncHandler from '../utils/asyncHandler';
import Matchup, { TournamentStage } from '../models/Matchup';
import Match, { MatchStatus } from '../models/Match';
import Team from '../models/Team';
import SpeakerScore from '../models/SpeakerScore';
import School from '../models/School';
import Event, { EventStatus } from '../models/Event';
import { emitToEvent } from '../socket';
import mongoose from 'mongoose';

const supportsTransactions = () => {
  const topologyType = (mongoose.connection as any)?.client?.topology?.description?.type;
  return topologyType === 'ReplicaSetWithPrimary' || topologyType === 'Sharded';
};

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

  if ((stage && stage !== TournamentStage.PRELIMINARY) || event.status !== EventStatus.PRELIMINARY_ROUNDS) {
    res.status(400);
    throw new Error('Manual matchup creation is only allowed for Preliminary stage when event is in Preliminary Rounds');
  }

  if (schoolBId && String(schoolAId) === String(schoolBId)) {
    res.status(400);
    throw new Error('schoolAId and schoolBId must be different');
  }

  const schoolA = await School.findOne({ _id: schoolAId, event: eventId });
  if (!schoolA) {
    res.status(400);
    throw new Error('schoolAId does not belong to this event');
  }

  let schoolB = null;
  if (schoolBId) {
    schoolB = await School.findOne({ _id: schoolBId, event: eventId });
    if (!schoolB) {
      res.status(400);
      throw new Error('schoolBId does not belong to this event');
    }
  }

  const overlapQuery = schoolBId
    ? {
      event: eventId,
      stage: TournamentStage.PRELIMINARY,
      $or: [
        { schoolA: schoolAId },
        { schoolB: schoolAId },
        { schoolA: schoolBId },
        { schoolB: schoolBId },
      ],
    }
    : {
      event: eventId,
      stage: TournamentStage.PRELIMINARY,
      $or: [{ schoolA: schoolAId }, { schoolB: schoolAId }],
    };

  const overlappingMatchup = await Matchup.findOne(overlapQuery);
  if (overlappingMatchup) {
    res.status(409);
    throw new Error('One or both schools are already assigned to a preliminary matchup');
  }

  const matchup = await Matchup.create({
    event: String(eventId),
    schoolA: String(schoolAId),
    schoolB: schoolBId ? String(schoolBId) : undefined,
    stage: stage || TournamentStage.PRELIMINARY,
  });

  // For preliminary rounds, generate full cross-school pairings:
  // each team in school A plays each team in school B (e.g., 3 x 3 = 9 matches).
  if (schoolBId) {
    const teamsA = await Team.find({ school: schoolAId, event: String(eventId) }).sort({ teamNumber: 1 });
    const teamsB = await Team.find({ school: schoolBId, event: String(eventId) }).sort({ teamNumber: 1 });

    for (const teamA of teamsA) {
      for (const teamB of teamsB) {
        await Match.create({
          matchup: matchup._id as any,
          event: String(eventId),
          teamA: teamA._id as any,
          teamB: teamB._id as any,
          stage: TournamentStage.PRELIMINARY,
          status: MatchStatus.PENDING,
        });
      }
    }
  }

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

  if (teamBId && String(teamAId) === String(teamBId)) {
    res.status(400);
    throw new Error('teamAId and teamBId must be different');
  }

  const matchup = await Matchup.findById(matchupId);
  if (!matchup) {
    res.status(404);
    throw new Error('Matchup not found');
  }

  const teamA = await Team.findById(teamAId);
  if (!teamA) {
    res.status(404);
    throw new Error('teamA not found');
  }
  if (teamA.event.toString() !== matchup.event.toString()) {
    res.status(400);
    throw new Error('teamA does not belong to this matchup event');
  }
  if (teamA.school.toString() !== matchup.schoolA.toString() && teamA.school.toString() !== matchup.schoolB?.toString()) {
    res.status(400);
    throw new Error('teamA does not belong to either school in this matchup');
  }

  let teamB = null;
  if (teamBId) {
    teamB = await Team.findById(teamBId);
    if (!teamB) {
      res.status(404);
      throw new Error('teamB not found');
    }
    if (teamB.event.toString() !== matchup.event.toString()) {
      res.status(400);
      throw new Error('teamB does not belong to this matchup event');
    }
    if (teamB.school.toString() !== matchup.schoolA.toString() && teamB.school.toString() !== matchup.schoolB?.toString()) {
      res.status(400);
      throw new Error('teamB does not belong to either school in this matchup');
    }
    if (teamA.school.toString() === teamB.school.toString()) {
      res.status(400);
      throw new Error('Both teams cannot be from the same school in one matchup match');
    }
  }

  const duplicate = await Match.findOne({
    matchup: matchupId,
    $or: [
      { teamA: teamAId, teamB: teamBId || null },
      { teamA: teamBId || null, teamB: teamAId },
    ],
  });
  if (duplicate) {
    res.status(409);
    throw new Error('This match pairing already exists in the matchup');
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

// @desc    Update team pairing for a match within its matchup schools
// @route   PATCH /api/v1/matches/:id/pairing
// @access  Private
export const updateMatchPairing = asyncHandler(async (req: Request, res: Response) => {
  const { teamAId, teamBId } = req.body;
  if (!teamAId || !teamBId) {
    res.status(400);
    throw new Error('teamAId and teamBId are required');
  }

  const match = await Match.findById(req.params.id);
  if (!match) {
    res.status(404);
    throw new Error('Match not found');
  }

  const teamA = await Team.findById(teamAId);
  const teamB = await Team.findById(teamBId);
  if (!teamA || !teamB) {
    res.status(404);
    throw new Error('One or both teams not found');
  }

  const teamASchool = teamA.school.toString();
  const teamBSchool = teamB.school.toString();

  if (teamASchool === teamBSchool) {
    res.status(400);
    throw new Error('Selected teams must belong to different schools');
  }

  match.teamA = teamA._id as any;
  match.teamB = teamB._id as any;
  match.winner = undefined;
  match.loser = undefined;
  match.winnerSpeakerPoints = 0;
  match.loserSpeakerPoints = 0;
  match.status = MatchStatus.PENDING;
  match.scoredBy = undefined;
  match.scoredAt = undefined;
  await match.save();

  res.json(match);
});

// @desc    Enter or correct a match result
// @route   PATCH /api/v1/matches/:id/result
// @access  Private
export const enterMatchResult = asyncHandler(async (req: Request, res: Response) => {
  const { winnerId, loserId, teamASpeakerScores, teamBSpeakerScores } = req.body;

  const match = await Match.findById(req.params.id);
  if (!match) {
    res.status(404);
    throw new Error('Match not found');
  }

  // Feature 5: Validate 30-point cap
  const validateScores = (scores: any[]) => {
    if (!Array.isArray(scores)) return false;
    for (const s of scores) {
      if (Number(s.points) > 30) return false;
    }
    return true;
  };

  const isByePractice = match.isByePractice;

  if (isByePractice) {
    if (!validateScores(teamASpeakerScores)) {
      res.status(400);
      throw new Error('Speaker score cannot exceed 30 points');
    }
  } else {
    if (!winnerId || !loserId) {
      res.status(400);
      throw new Error('winnerId and loserId are required');
    }
    if (!Array.isArray(teamASpeakerScores) || teamASpeakerScores.length === 0) {
      res.status(400);
      throw new Error('teamASpeakerScores are required');
    }
    if (!Array.isArray(teamBSpeakerScores) || teamBSpeakerScores.length === 0) {
      res.status(400);
      throw new Error('teamBSpeakerScores are required');
    }
    if (!validateScores(teamASpeakerScores) || !validateScores(teamBSpeakerScores)) {
      res.status(400);
      throw new Error('Speaker score cannot exceed 30 points');
    }
    const validTeams = [match.teamA?.toString(), match.teamB?.toString()].filter(Boolean);
    if (!validTeams.includes(winnerId.toString()) || !validTeams.includes(loserId.toString())) {
      res.status(400);
      throw new Error('Winner and loser must be the two teams in this match');
    }
  }

  const runUpdates = async (session?: mongoose.ClientSession) => {
    const isCorrection = match.status === MatchStatus.COMPLETED && (match.winner || isByePractice);

    if (isCorrection) {
      // Reverse previous changes
      if (isByePractice) {
        const previousWinnerPts = match.winnerSpeakerPoints ?? 0;
        await Team.findByIdAndUpdate(match.teamA, {
          $inc: { totalPoints: -previousWinnerPts, matchesWon: -1, matchesPlayed: -1 },
        }, session ? { session } : {});
        const prevAScores = match.teamASpeakerScores ?? [];
        const teamADoc = await Team.findById(match.teamA);
        if (teamADoc) {
          for (const s of prevAScores) {
            const member = teamADoc.members.find(m => m._id?.toString() === s.memberId.toString());
            if (member) member.totalSpeakerPoints = (member.totalSpeakerPoints ?? 0) - s.points;
          }
          await teamADoc.save(session ? { session } : {});
        }
      } else {
        const previousWinnerId = match.winner!.toString();
        const validTeams = [match.teamA?.toString(), match.teamB?.toString()].filter(Boolean);
        const previousLoserId = match.loser?.toString() || validTeams.find((id) => id !== previousWinnerId);
        const previousWinnerPts = match.winnerSpeakerPoints ?? 0;
        const previousLoserPts = match.loserSpeakerPoints ?? 0;

        await Team.findByIdAndUpdate(previousWinnerId, {
          $inc: { totalPoints: -previousWinnerPts, pointsConceded: -previousLoserPts, matchesWon: -1, matchesPlayed: -1 },
        }, session ? { session } : {});
        if (previousLoserId) {
          await Team.findByIdAndUpdate(previousLoserId, {
            $inc: { totalPoints: -previousLoserPts, pointsConceded: -previousWinnerPts, matchesPlayed: -1 },
          }, session ? { session } : {});
        }

        const prevAScores = match.teamASpeakerScores ?? [];
        const prevBScores = match.teamBSpeakerScores ?? [];
        const teamADoc = await Team.findById(match.teamA);
        const teamBDoc = match.teamB ? await Team.findById(match.teamB) : null;

        if (teamADoc) {
          for (const s of prevAScores) {
            const member = teamADoc.members.find(m => m._id?.toString() === s.memberId.toString());
            if (member) member.totalSpeakerPoints = (member.totalSpeakerPoints ?? 0) - s.points;
          }
          await teamADoc.save(session ? { session } : {});
        }
        if (teamBDoc) {
          for (const s of prevBScores) {
            const member = teamBDoc.members.find(m => m._id?.toString() === s.memberId.toString());
            if (member) member.totalSpeakerPoints = (member.totalSpeakerPoints ?? 0) - s.points;
          }
          await teamBDoc.save(session ? { session } : {});
        }
      }
      
      // Delete old SpeakerScore docs
      await SpeakerScore.deleteMany({ matchId: match._id }, session ? { session } : {});
    }

    if (isByePractice) {
      // Feature 3: max score instead of sum
      const maxScore = teamASpeakerScores.reduce((max: number, s: any) => Math.max(max, Number(s.points) || 0), 0);
      
      await Team.findByIdAndUpdate(match.teamA, {
        $inc: { totalPoints: maxScore, matchesWon: 1, matchesPlayed: 1 },
      }, session ? { session } : {});

      const teamADoc = await Team.findById(match.teamA);
      if (teamADoc) {
        for (const s of teamASpeakerScores as any[]) {
          const member = teamADoc.members.find(m => m._id?.toString() === s.memberId);
          if (member) member.totalSpeakerPoints = (member.totalSpeakerPoints ?? 0) + (Number(s.points) || 0);
          
          await SpeakerScore.create([{
            memberId: s.memberId,
            matchId: match._id,
            roundNumber: match.round || 1,
            pointsScored: Number(s.points) || 0,
            event: match.event
          }], session ? { session } : {});
        }
        await teamADoc.save(session ? { session } : {});
      }

      match.winner = match.teamA;
      match.winnerSpeakerPoints = maxScore;
      match.teamASpeakerScores = teamASpeakerScores.map((s: any) => ({ memberId: s.memberId, points: Number(s.points) || 0 }));
      match.status = MatchStatus.COMPLETED;
    } else {
      // Normal match
      const sumA = (teamASpeakerScores as any[]).reduce((s: number, m: any) => s + (Number(m.points) || 0), 0);
      const sumB = (teamBSpeakerScores as any[]).reduce((s: number, m: any) => s + (Number(m.points) || 0), 0);
      
      const isWinnerA = winnerId.toString() === match.teamA?.toString();
      const winPts = isWinnerA ? sumA : sumB;
      const losePts = isWinnerA ? sumB : sumA;

      await Team.findByIdAndUpdate(String(winnerId), {
        $inc: { totalPoints: winPts, pointsConceded: losePts, matchesWon: 1, matchesPlayed: 1 },
      }, session ? { session } : {});
      await Team.findByIdAndUpdate(String(loserId), {
        $inc: { totalPoints: losePts, pointsConceded: winPts, matchesPlayed: 1 },
      }, session ? { session } : {});

      const teamADoc = await Team.findById(match.teamA);
      const teamBDoc = match.teamB ? await Team.findById(match.teamB) : null;

      if (teamADoc) {
        for (const s of teamASpeakerScores as any[]) {
          const member = teamADoc.members.find(m => m._id?.toString() === s.memberId);
          if (member) member.totalSpeakerPoints = (member.totalSpeakerPoints ?? 0) + (Number(s.points) || 0);
          
          await SpeakerScore.create([{
            memberId: s.memberId,
            matchId: match._id,
            roundNumber: match.round || 1,
            pointsScored: Number(s.points) || 0,
            event: match.event
          }], session ? { session } : {});
        }
        await teamADoc.save(session ? { session } : {});
      }
      if (teamBDoc) {
        for (const s of teamBSpeakerScores as any[]) {
          const member = teamBDoc.members.find(m => m._id?.toString() === s.memberId);
          if (member) member.totalSpeakerPoints = (member.totalSpeakerPoints ?? 0) + (Number(s.points) || 0);
          
          await SpeakerScore.create([{
            memberId: s.memberId,
            matchId: match._id,
            roundNumber: match.round || 1,
            pointsScored: Number(s.points) || 0,
            event: match.event
          }], session ? { session } : {});
        }
        await teamBDoc.save(session ? { session } : {});
      }

      match.winner = winnerId;
      match.loser = loserId as any;
      match.winnerSpeakerPoints = winPts;
      match.loserSpeakerPoints = losePts;
      match.teamASpeakerScores = teamASpeakerScores.map((s: any) => ({ memberId: s.memberId, points: Number(s.points) || 0 }));
      match.teamBSpeakerScores = teamBSpeakerScores.map((s: any) => ({ memberId: s.memberId, points: Number(s.points) || 0 }));
      match.status = MatchStatus.COMPLETED;
    }

    match.scoredBy = req.user?._id as any;
    match.scoredAt = new Date();
    await match.save(session ? { session } : {});
  };

  if (supportsTransactions()) {
    const session = await mongoose.startSession();
    try {
      session.startTransaction();
      await runUpdates(session);
      await session.commitTransaction();
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  } else {
    await runUpdates();
  }

  emitToEvent(match.event.toString(), 'match:updated', match);

  if ([TournamentStage.ROUND_OF_16, TournamentStage.QUARTER_FINAL, TournamentStage.SEMI_FINAL, TournamentStage.FINAL].includes(match.stage)) {
    await advanceWinnerToNextRound(match.event.toString(), match.stage, match.bracketSlot ?? 0, match.winner as mongoose.Types.ObjectId);
  }

  res.json(match);
});

// Helper to advance a single winner into the next bracket slot immediately after scoring
async function advanceWinnerToNextRound(eventId: string, currentStage: TournamentStage, currentSlot: number, winnerId: mongoose.Types.ObjectId) {
  const winner = await Team.findById(winnerId);
  if (!winner) return;

  // Determine next stage and which slot the winner goes into
  let nextStage: TournamentStage | null = null;
  let nextSlot: number;
  let position: 'teamA' | 'teamB';

  if (currentStage === TournamentStage.ROUND_OF_16) {
    nextStage = TournamentStage.QUARTER_FINAL;
    // R16 slots 0-7 → QF slots 0-3, two R16 winners per QF match
    // Pairing: [0,7]→QF0, [1,6]→QF1, [2,5]→QF2, [3,4]→QF3
    const r16Pairings: [number, number, number][] = [
      [0, 7, 0], [1, 6, 1], [2, 5, 2], [3, 4, 3]
    ];
    const pair = r16Pairings.find(([a, b]) => a === currentSlot || b === currentSlot);
    if (!pair) return;
    nextSlot = pair[2];
    position = currentSlot === pair[0] ? 'teamA' : 'teamB';
  } else if (currentStage === TournamentStage.QUARTER_FINAL) {
    nextStage = TournamentStage.SEMI_FINAL;
    // QF slots 0-3 → SF slots 0-1
    // Pairing: [0,3]→SF0, [1,2]→SF1
    const qfPairings: [number, number, number][] = [
      [0, 3, 0], [1, 2, 1]
    ];
    const pair = qfPairings.find(([a, b]) => a === currentSlot || b === currentSlot);
    if (!pair) return;
    nextSlot = pair[2];
    position = currentSlot === pair[0] ? 'teamA' : 'teamB';
  } else if (currentStage === TournamentStage.SEMI_FINAL) {
    nextStage = TournamentStage.FINAL;
    nextSlot = 0;
    position = currentSlot === 0 ? 'teamA' : 'teamB';
  } else {
    // FINAL completed — mark event as done
    const event = await Event.findById(eventId);
    if (event) { event.status = EventStatus.COMPLETED; await event.save(); }
    emitToEvent(eventId, 'event:statusChanged', { status: EventStatus.COMPLETED });
    return;
  }

  // Find or create the next-round match for this slot
  let nextMatch = await Match.findOne({ event: eventId, stage: nextStage, bracketSlot: nextSlot });

  if (!nextMatch) {
    // Create a placeholder match with just this team
    nextMatch = await Match.create({
      event: eventId,
      stage: nextStage,
      bracketSlot: nextSlot,
      teamA: position === 'teamA' ? winner._id : undefined,
      teamB: position === 'teamB' ? winner._id : undefined,
      status: MatchStatus.PENDING,
    });
  } else {
    // Slot the winner into the correct position
    if (position === 'teamA') nextMatch.teamA = winner._id as any;
    else nextMatch.teamB = winner._id as any;
    await nextMatch.save();
  }

  // Emit updated bracket so frontend refreshes immediately
  const updatedMatches = await Match.find({ event: eventId, stage: nextStage })
    .populate('teamA', 'name totalPoints members')
    .populate('teamB', 'name totalPoints members')
    .populate('winner', 'name totalPoints');
  emitToEvent(eventId, 'bracket:updated', { stage: nextStage, matches: updatedMatches });

  // If this is the Final and it now has both teams, also emit bracket:generated
  if (nextStage === TournamentStage.FINAL && nextMatch.teamA && nextMatch.teamB) {
    emitToEvent(eventId, 'bracket:generated', { stage: nextStage });
  }
}

// @desc    Manually assign up to 3 opponents for a single team
// @route   POST /api/v1/events/:eventId/matchups/manual
// @access  Private
export const manualAssignTeam = asyncHandler(async (req: Request, res: Response) => {
  const { eventId } = req.params;
  const { teamId, opponents } = req.body; // opponents: string[] (1-3 teamIds)

  if (!teamId || !Array.isArray(opponents) || opponents.length === 0) {
    res.status(400);
    throw new Error('teamId and at least one opponent are required');
  }

  if (opponents.length > 3) {
    res.status(400);
    throw new Error('A team can have at most 3 preliminary matches');
  }

  const event = await Event.findById(eventId);
  if (!event || event.status !== EventStatus.PRELIMINARY_ROUNDS) {
    res.status(400);
    throw new Error('Event must be in Preliminary Rounds to assign matchups');
  }

  const team = await Team.findOne({ _id: teamId, event: eventId });
  if (!team) {
    res.status(404);
    throw new Error('Team not found in this event');
  }

  // Check how many matches this team already has
  const existingMatches = await Match.find({
    event: eventId,
    stage: TournamentStage.PRELIMINARY,
    $or: [{ teamA: teamId }, { teamB: teamId }],
    isBye: { $ne: true },
  });

  if (existingMatches.length + opponents.length > 3) {
    res.status(400);
    throw new Error(`Team already has ${existingMatches.length} match(es). Can only add ${3 - existingMatches.length} more.`);
  }

  const created: any[] = [];

  for (const opponentId of opponents) {
    if (opponentId === teamId) {
      res.status(400);
      throw new Error('A team cannot play against itself');
    }

    const opponent = await Team.findOne({ _id: opponentId, event: eventId });
    if (!opponent) {
      res.status(404);
      throw new Error(`Opponent team ${opponentId} not found in this event`);
    }

    if (opponent.school.toString() === team.school.toString()) {
      res.status(400);
      throw new Error(`${team.name} and ${opponent.name} are from the same school`);
    }

    // Check duplicate pairing
    const duplicate = await Match.findOne({
      event: eventId,
      stage: TournamentStage.PRELIMINARY,
      $or: [
        { teamA: teamId, teamB: opponentId },
        { teamA: opponentId, teamB: teamId },
      ],
    });
    if (duplicate) {
      res.status(409);
      throw new Error(`${team.name} vs ${opponent.name} match already exists`);
    }

    // Check opponent doesn't already have 3 matches
    const opponentMatchCount = await Match.countDocuments({
      event: eventId,
      stage: TournamentStage.PRELIMINARY,
      $or: [{ teamA: opponentId }, { teamB: opponentId }],
      isBye: { $ne: true },
    });
    if (opponentMatchCount >= 3) {
      res.status(400);
      throw new Error(`${opponent.name} already has 3 matches assigned`);
    }

    const match = await Match.create({
      event: String(eventId),
      teamA: teamId,
      teamB: opponentId,
      stage: TournamentStage.PRELIMINARY,
      status: MatchStatus.PENDING,
      round: existingMatches.length + created.length + 1,
    });
    created.push(match);
    console.log(`[manualAssign] created match: ${team.name} vs ${opponent.name}`);
  }

  emitToEvent(String(eventId), 'matchups:created', { matchesCount: created.length });
  res.status(201).json({ message: `${created.length} match(es) created`, matches: created });
});

// @desc    Auto-assign preliminary matchups at team level (greedy scheduler)
// @route   POST /api/v1/events/:eventId/matchups/auto
// @access  Private
export const autoAssignMatchups = asyncHandler(async (req: Request, res: Response) => {
  const { eventId } = req.params;

  const event = await Event.findById(eventId);
  if (!event || event.status !== EventStatus.PRELIMINARY_ROUNDS) {
    res.status(400);
    throw new Error('Event must be in Preliminary Rounds stage to auto-assign matchups');
  }

  const teams = await Team.find({ event: eventId });
  const teamCount = teams.length;
  console.log(`[autoAssign] eventId=${eventId} teamCount=${teamCount}`);

  if (teamCount < 2) {
    res.status(400);
    throw new Error('At least 2 teams are required to assign matchups');
  }

  const ROUNDS = 3;
  const matchCount = new Map<string, number>();
  const paired = new Map<string, Set<string>>();
  const schoolMatchupHistory = new Set<string>();
  teams.forEach(t => {
    matchCount.set(t._id.toString(), 0);
    paired.set(t._id.toString(), new Set());
  });

  const matchesPerRound: [string, string][][] = [];

  for (let round = 0; round < ROUNDS; round++) {
    const roundPairs: [string, string][] = [];
    const usedThisRound = new Set<string>();
    // Sort by fewest matches assigned so far
    const sortedTeams = [...teams].sort((a, b) =>
      (matchCount.get(a._id.toString()) ?? 0) - (matchCount.get(b._id.toString()) ?? 0)
    );
    for (const team of sortedTeams) {
      const tid = team._id.toString();
      if (usedThisRound.has(tid) || (matchCount.get(tid) ?? 0) >= ROUNDS) continue;
      const candidates = sortedTeams.filter(opp => {
        const oid = opp._id.toString();
        return (
          oid !== tid &&
          !usedThisRound.has(oid) &&
          opp.school.toString() !== team.school.toString() &&
          !paired.get(tid)!.has(oid) &&
          (matchCount.get(oid) ?? 0) < ROUNDS
        );
      });
      if (candidates.length === 0) continue;
      
      const teamSchoolStr = team.school.toString();
      const idealCandidates = candidates.filter(opp => {
        const oppSchoolStr = opp.school.toString();
        const schoolPair = [teamSchoolStr, oppSchoolStr].sort().join('_');
        return !schoolMatchupHistory.has(schoolPair);
      });

      let opponent = idealCandidates[0];
      if (!opponent) {
        console.warn(`[autoAssign] Warning: Mathematically impossible to avoid school repeat for team ${tid}. Falling back to a repeated school matchup.`);
        opponent = candidates[0];
      }

      const oid = opponent._id.toString();
      const oppSchoolStr = opponent.school.toString();
      const schoolPairToRecord = [teamSchoolStr, oppSchoolStr].sort().join('_');

      roundPairs.push([tid, oid]);
      usedThisRound.add(tid);
      usedThisRound.add(oid);
      matchCount.set(tid, (matchCount.get(tid) ?? 0) + 1);
      matchCount.set(oid, (matchCount.get(oid) ?? 0) + 1);
      paired.get(tid)!.add(oid);
      paired.get(oid)!.add(tid);
      schoolMatchupHistory.add(schoolPairToRecord);
    }
    matchesPerRound.push(roundPairs);
    console.log(`[autoAssign] round=${round + 1} pairs=${roundPairs.length}`);
  }

  // Teams with fewer than ROUNDS matches get BYE records
  const byeTeams: string[] = [];
  for (const [tid, count] of matchCount.entries()) {
    if (count < ROUNDS) {
      byeTeams.push(tid);
      console.log(`[autoAssign] team ${tid} has ${count} matches, needs BYE`);
    }
  }

  const totalReal = matchesPerRound.reduce((s, r) => s + r.length, 0);
  console.log(`[autoAssign] totalReal=${totalReal} byeTeams=${byeTeams.length}`);

  if (totalReal === 0) {
    res.status(400);
    throw new Error('Could not generate any valid matches — all teams may be from the same school');
  }

  const matchesCreated: any[] = [];

  const persist = async () => {
    for (let round = 0; round < ROUNDS; round++) {
      for (const [a, b] of matchesPerRound[round]) {
        const match = await Match.create({
          event: String(eventId),
          teamA: a,
          teamB: b,
          stage: TournamentStage.PRELIMINARY,
          status: MatchStatus.PENDING,
          round: round + 1,
        });
        matchesCreated.push(match);
        console.log(`[autoAssign] created match round=${round + 1} ${a} vs ${b}`);
      }
    }
    for (const tid of byeTeams) {
      const byeRound = matchesPerRound.findIndex(r => !r.some(([a, b]) => a === tid || b === tid)) + 1;
      const match = await Match.create({
        event: String(eventId),
        teamA: tid,
        stage: TournamentStage.PRELIMINARY,
        status: MatchStatus.PENDING,
        isBye: true,
        isByePractice: true,
        round: byeRound || ROUNDS,
      });
      matchesCreated.push(match);
      console.log(`[autoAssign] BYE team=${tid} round=${byeRound || ROUNDS}`);
    }
  };

  try {
    await persist();
  } catch (err: any) {
    console.error('[autoAssign] failed:', err);
    res.status(500);
    throw new Error(`Failed to save matches: ${err.message}`);
  }

  console.log(`[autoAssign] done — ${matchesCreated.length} records created`);
  const response = {
    message: `Generated ${matchesCreated.length} match records for ${teamCount} teams.`,
    matchesCount: matchesCreated.length,
    rounds: ROUNDS,
    ...(byeTeams.length > 0 && { byeTeams, notice: `${byeTeams.length} team(s) received a BYE` }),
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

  const schoolsCount = await School.countDocuments({ event: eventId });
  const useRoundOf16 = schoolsCount > 18;
  const numTeams = useRoundOf16 ? 16 : 8;

  let teams: Awaited<ReturnType<typeof Team.find>>;

  if (teamIds) {
    if (!Array.isArray(teamIds) || teamIds.length !== numTeams) {
      res.status(400);
      throw new Error(`teamIds must be an array of exactly ${numTeams} team IDs`);
    }
    const found = await Team.find({ _id: { $in: teamIds }, event: eventId });
    if (found.length !== numTeams) {
      res.status(400);
      throw new Error('One or more teamIds are invalid or do not belong to this event');
    }
    teams = teamIds.map((id: string) => found.find((t) => t._id.toString() === id)!);
  } else {
    teams = await Team.find({ event: eventId })
      .sort({ totalPoints: -1, matchesPlayed: 1 })
      .limit(numTeams);
    if (teams.length < numTeams) {
      res.status(400);
      throw new Error(`Not enough teams to form bracket — only ${teams.length} teams found`);
    }
  }

  let seeds;
  let stage;
  if (useRoundOf16) {
    stage = TournamentStage.ROUND_OF_16;
    seeds = [
      [teams[0], teams[15]],
      [teams[1], teams[14]],
      [teams[2], teams[13]],
      [teams[3], teams[12]],
      [teams[4], teams[11]],
      [teams[5], teams[10]],
      [teams[6], teams[9]],
      [teams[7], teams[8]],
    ];
  } else {
    stage = TournamentStage.QUARTER_FINAL;
    seeds = [
      [teams[0], teams[7]],
      [teams[1], teams[6]],
      [teams[2], teams[5]],
      [teams[3], teams[4]],
    ];
  }

  const matchups: any[] = [];

  for (let i = 0; i < seeds.length; i++) {
    const [teamA, teamB] = seeds[i];
    const matchup = await Matchup.create({
      event: String(eventId),
      schoolA: teamA.school as any,
      schoolB: teamB.school as any,
      stage: stage,
      bracketSlot: i,
    });

    await Match.create({
      matchup: matchup._id as any,
      event: String(eventId),
      teamA: teamA._id as any,
      teamB: teamB._id as any,
      stage: stage,
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
  const loserId = match.loser?.toString() || [match.teamA?.toString(), match.teamB?.toString()].find((id) => id && id !== winnerId);
  const winnerPts = match.winnerSpeakerPoints ?? 3;
  const loserPts = match.loserSpeakerPoints ?? 0;

  const runVoid = async (session?: mongoose.ClientSession) => {
    await Team.findByIdAndUpdate(winnerId, { $inc: { totalPoints: -winnerPts, matchesWon: -1, matchesPlayed: -1 } }, session ? { session } : {});
    if (loserId) await Team.findByIdAndUpdate(loserId, { $inc: { totalPoints: -loserPts, matchesPlayed: -1 } }, session ? { session } : {});

    // Reverse individual member speaker points
    const teamADoc = await Team.findById(match.teamA);
    const teamBDoc = match.teamB ? await Team.findById(match.teamB) : null;
    if (teamADoc) {
      for (const s of match.teamASpeakerScores ?? []) {
        const member = teamADoc.members.find(m => m._id?.toString() === s.memberId.toString());
        if (member) member.totalSpeakerPoints = (member.totalSpeakerPoints ?? 0) - s.points;
      }
      await teamADoc.save(session ? { session } : {});
    }
    if (teamBDoc) {
      for (const s of match.teamBSpeakerScores ?? []) {
        const member = teamBDoc.members.find(m => m._id?.toString() === s.memberId.toString());
        if (member) member.totalSpeakerPoints = (member.totalSpeakerPoints ?? 0) - s.points;
      }
      await teamBDoc.save(session ? { session } : {});
    }

    match.winner = undefined;
    match.loser = undefined;
    match.winnerSpeakerPoints = 0;
    match.loserSpeakerPoints = 0;
    match.teamASpeakerScores = [];
    match.teamBSpeakerScores = [];
    match.status = MatchStatus.PENDING;
    match.scoredBy = undefined;
    match.scoredAt = undefined;
    await match.save(session ? { session } : {});
  };

  if (supportsTransactions()) {
    const session = await mongoose.startSession();
    try {
      session.startTransaction();
      await runVoid(session);
      await session.commitTransaction();
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  } else {
    await runVoid();
  }

  emitToEvent(match.event.toString(), 'match:updated', match);

  res.json({ message: 'Match result voided', match });
});

// @desc    Cancel all preliminary matchups for an event (reset to re-assign)
// @route   DELETE /api/v1/events/:eventId/matchups/preliminary
// @access  Private
export const cancelPreliminaryMatchups = asyncHandler(async (req: Request, res: Response) => {
  const { eventId } = req.params;

  const event = await Event.findById(eventId);
  if (!event || (event.status !== EventStatus.PRELIMINARY_ROUNDS && event.status !== EventStatus.REGISTRATION_OPEN)) {
    res.status(400);
    throw new Error('Event must be in Preliminary Rounds or Registration Open stage to cancel matchups');
  }

  const prelimMatches = await Match.find({ event: eventId, stage: TournamentStage.PRELIMINARY });

  const runReset = async (session?: mongoose.ClientSession) => {
    const teamAdjustments = new Map<string, { totalPoints: number; matchesWon: number; matchesPlayed: number }>();

    for (const match of prelimMatches) {
      if (match.status !== MatchStatus.COMPLETED || !match.winner) continue;

      const winnerId = match.winner.toString();
      const loserId =
        match.loser?.toString() ||
        [match.teamA?.toString(), match.teamB?.toString()].find((id) => id && id !== winnerId);
      const winnerPts = match.winnerSpeakerPoints ?? 3;
      const loserPts = match.loserSpeakerPoints ?? 0;

      const w = teamAdjustments.get(winnerId) || { totalPoints: 0, matchesWon: 0, matchesPlayed: 0 };
      w.totalPoints -= winnerPts;
      w.matchesWon -= 1;
      w.matchesPlayed -= 1;
      teamAdjustments.set(winnerId, w);

      if (loserId) {
        const l = teamAdjustments.get(loserId) || { totalPoints: 0, matchesWon: 0, matchesPlayed: 0 };
        l.totalPoints -= loserPts;
        l.matchesPlayed -= 1;
        teamAdjustments.set(loserId, l);
      }
    }

    if (teamAdjustments.size > 0) {
      const ops = [...teamAdjustments.entries()].map(([teamId, inc]) => ({
        updateOne: {
          filter: { _id: teamId },
          update: { $inc: inc },
        },
      }));
      await Team.bulkWrite(ops, session ? { session } : {});
    }

    await Match.deleteMany({ event: eventId, stage: TournamentStage.PRELIMINARY }, session ? { session } : {});
    await Matchup.deleteMany({ event: eventId, stage: TournamentStage.PRELIMINARY }, session ? { session } : {});

    event.status = EventStatus.REGISTRATION_OPEN;
    await event.save(session ? { session } : {});
    emitToEvent(String(eventId), 'event:statusChanged', { status: EventStatus.REGISTRATION_OPEN });
  };

  if (supportsTransactions()) {
    const session = await mongoose.startSession();
    try {
      session.startTransaction();
      await runReset(session);
      await session.commitTransaction();
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  } else {
    await runReset();
  }

  res.json({ message: 'All preliminary matchups and results reset. You may re-assign.' });
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
  const { eventId } = req.params;
  
  const prelimMatches = await Match.find({ event: eventId, stage: TournamentStage.PRELIMINARY })
    .populate('teamA', 'name members')
    .populate('teamB', 'name members')
    .populate('winner', 'name');

  const teamSchedulesMap = new Map<string, any>();
  const teams = await Team.find({ event: eventId }).populate('school', 'name');

  teams.forEach(team => {
    teamSchedulesMap.set(team._id.toString(), {
      _id: team._id.toString(),
      team: { _id: team._id, name: team.name, members: team.members },
      matches: []
    });
  });

  prelimMatches.forEach(m => {
    if (m.teamA) {
      const scheduleA = teamSchedulesMap.get((m.teamA as any)._id.toString());
      if (scheduleA) scheduleA.matches.push(m);
    }
    if (m.teamB) {
      const scheduleB = teamSchedulesMap.get((m.teamB as any)._id.toString());
      if (scheduleB) scheduleB.matches.push(m);
    }
  });

  res.json(Array.from(teamSchedulesMap.values()));
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
  const stages = [TournamentStage.ROUND_OF_16, TournamentStage.QUARTER_FINAL, TournamentStage.SEMI_FINAL, TournamentStage.FINAL];

  const bracket: Record<string, any[]> = {};

  for (const stage of stages) {
    const matches = await Match.find({ event: req.params.eventId, stage })
      .populate('teamA', 'name totalPoints members')
      .populate('teamB', 'name totalPoints members')
      .populate('winner', 'name totalPoints');
    bracket[stage] = matches;
  }

  res.json(bracket);
});
