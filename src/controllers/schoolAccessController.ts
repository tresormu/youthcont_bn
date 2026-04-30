import { Request, Response } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import asyncHandler from '../utils/asyncHandler';
import TemporarySchoolAccess from '../models/TemporarySchoolAccess';
import School from '../models/School';
import Event from '../models/Event';
import Team from '../models/Team';
import Match, { MatchStatus } from '../models/Match';
import { TournamentStage } from '../models/Matchup';
import config from '../config/config';
import { sendSchoolOwnerAccessEmail } from '../utils/sendEmail';

const generateCode = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars (0/O, 1/I)
  let code = '';
  const bytes = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
};

// @desc    Generate school owner access code + QR
// @route   POST /api/v1/admin/school-access/generate
// @access  Seed Admin only
export const generateSchoolAccess = asyncHandler(async (req: Request, res: Response) => {
  const { school_id, email, event_id } = req.body;
  if (!school_id || !email || !event_id) {
    res.status(400); throw new Error('school_id, email, and event_id are required');
  }

  const [school, event] = await Promise.all([
    School.findOne({ _id: school_id, event: event_id }),
    Event.findById(event_id),
  ]);
  if (!school) { res.status(404); throw new Error('School not found for this event'); }
  if (!event) { res.status(404); throw new Error('Event not found'); }

  let accessCode: string;
  let attempts = 0;
  do {
    accessCode = generateCode();
    attempts++;
    if (attempts > 10) { res.status(500); throw new Error('Could not generate unique code'); }
  } while (await TemporarySchoolAccess.exists({ accessCode }));

  const expiresAt = new Date(Date.now() + 86400 * 1000);

  await TemporarySchoolAccess.create({
    email: email.toLowerCase().trim(),
    school: school_id,
    event: event_id,
    accessCode,
    expiresAt,
  });

  await sendSchoolOwnerAccessEmail({
    email: email.toLowerCase().trim(),
    schoolName: school.name,
    tournamentName: event.name,
    accessCode,
    expiresAt,
    loginUrl: `${config.clientUrl}/school-report`,
  });

  res.status(201).json({
    expires_at: expiresAt.toISOString(),
    message: 'Access created. Credentials have been sent to the school owner\'s email.',
  });
});

// @desc    School owner login with email + access code
// @route   POST /api/v1/school-report/login
// @access  Public
export const schoolOwnerLogin = asyncHandler(async (req: Request, res: Response) => {
  const { email, access_code } = req.body;
  if (!email || !access_code) {
    res.status(400); throw new Error('email and access_code are required');
  }

  const record = await TemporarySchoolAccess.findOne({
    email: email.toLowerCase().trim(),
    accessCode: access_code.toUpperCase().trim(),
  }).populate('school', 'name').populate('event', 'name');

  if (!record || record.expiresAt < new Date()) {
    res.status(401); throw new Error('Invalid email or code, or access expired');
  }

  const token = jwt.sign(
    { schoolId: record.school._id, eventId: record.event._id, role: 'school_owner', accessId: record._id },
    config.jwtSecret,
    { expiresIn: '24h' } as jwt.SignOptions
  );

  const isProd = config.nodeEnv !== 'development';
  res.cookie('school_jwt', token, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    maxAge: 24 * 60 * 60 * 1000,
  });

  const school = record.school as any;
  const event = record.event as any;

  res.json({
    token,
    school_id: school._id,
    school_name: school.name,
    event_name: event.name,
    expires_at: record.expiresAt.toISOString(),
    redirect: '/school-report/dashboard',
  });
});

// @desc    Get school report dashboard data
// @route   GET /api/v1/school-report/dashboard
// @access  school_owner (via school_jwt cookie)
export const getSchoolReportDashboard = asyncHandler(async (req: Request, res: Response) => {
  const { schoolId, eventId, accessId } = (req as any).schoolOwner;

  const access = await TemporarySchoolAccess.findById(accessId);
  if (!access || access.expiresAt < new Date()) {
    res.status(401); throw new Error('Access expired');
  }

  const [school, event, allTeams] = await Promise.all([
    School.findById(schoolId),
    Event.findById(eventId),
    Team.find({ event: eventId }).sort({ totalPoints: -1 }),
  ]);

  if (!school || !event) { res.status(404); throw new Error('School or event not found'); }

  const schoolTeams = allTeams.filter(t => t.school.toString() === schoolId.toString());
  const totalSpeakerPoints = schoolTeams.reduce((s, t) => s + t.totalPoints, 0);

  const schoolPointsMap = new Map<string, number>();
  for (const t of allTeams) {
    const sid = t.school.toString();
    schoolPointsMap.set(sid, (schoolPointsMap.get(sid) ?? 0) + t.totalPoints);
  }
  const sortedSchools = [...schoolPointsMap.entries()].sort((a, b) => b[1] - a[1]);
  const schoolRank = sortedSchools.findIndex(([sid]) => sid === schoolId.toString()) + 1;

  const allMatches = await Match.find({ event: eventId, status: MatchStatus.COMPLETED })
    .populate('teamA', '_id name')
    .populate('teamB', '_id name')
    .populate('winner', '_id')
    .populate('loser', '_id');

  const getId = (ref: any): string => {
    if (!ref) return '';
    if (ref._id) return ref._id.toString();
    return ref.toString();
  };

  const bracketStages = [
    TournamentStage.ROUND_OF_16,
    TournamentStage.QUARTER_FINAL,
    TournamentStage.SEMI_FINAL,
    TournamentStage.FINAL,
  ];

  const getTeamStatus = (teamId: string): string => {
    const finalWin = allMatches.find(
      m => m.stage === TournamentStage.FINAL && getId(m.winner) === teamId
    );
    if (finalWin) return 'Tournament Winner';

    const eliminationLabels: Record<string, string> = {
      [TournamentStage.FINAL]: 'Runner-up',
      [TournamentStage.SEMI_FINAL]: 'Eliminated in Semi-finals',
      [TournamentStage.QUARTER_FINAL]: 'Eliminated in Quarter-finals',
      [TournamentStage.ROUND_OF_16]: 'Eliminated in Round of 16',
    };
    const advanceLabels: Record<string, string> = {
      [TournamentStage.FINAL]: 'Advanced to Final',
      [TournamentStage.SEMI_FINAL]: 'Advanced to Semi-finals',
      [TournamentStage.QUARTER_FINAL]: 'Advanced to Quarter-finals',
      [TournamentStage.ROUND_OF_16]: 'Advanced to Round of 16',
    };

    for (const stage of [...bracketStages].reverse()) {
      const match = allMatches.find(
        m => m.stage === stage &&
          (getId(m.teamA) === teamId || getId(m.teamB) === teamId)
      );
      if (!match) continue;
      if (getId(match.loser) === teamId) return eliminationLabels[stage] ?? `Eliminated in ${stage}`;
      if (getId(match.winner) === teamId) return advanceLabels[stage] ?? `Advanced to ${stage}`;
      // match exists but not yet scored — team is still in this stage
      return advanceLabels[stage] ?? `In ${stage}`;
    }

    return 'Eliminated in Preliminary Rounds';
  };

  const teamsData = await Promise.all(schoolTeams.map(async (team, idx) => {
    const teamId = team._id.toString();
    const teamRank = allTeams.findIndex(t => t._id.toString() === teamId) + 1;

    const teamMatches = allMatches.filter(
      m => getId(m.teamA) === teamId || getId(m.teamB) === teamId
    );

    // Sort: prelims first (by index), then bracket stages in order
    const stageOrder: Record<string, number> = {
      [TournamentStage.PRELIMINARY]: 0,
      [TournamentStage.ROUND_OF_16]: 1,
      [TournamentStage.QUARTER_FINAL]: 2,
      [TournamentStage.SEMI_FINAL]: 3,
      [TournamentStage.FINAL]: 4,
    };
    teamMatches.sort((a, b) => (stageOrder[a.stage] ?? 0) - (stageOrder[b.stage] ?? 0));

    let prelimCount = 0;
    const prelimMatches: any[] = [];
    const bracketMatches: any[] = [];

    teamMatches.forEach(m => {
      const isTeamA = getId(m.teamA) === teamId;
      const opponent = isTeamA ? m.teamB : m.teamA;
      const isWinner = getId(m.winner) === teamId;
      const myPts = isWinner ? (m.winnerSpeakerPoints ?? 0) : (m.loserSpeakerPoints ?? 0);
      const oppPts = isWinner ? (m.loserSpeakerPoints ?? 0) : (m.winnerSpeakerPoints ?? 0);

      if (m.stage === TournamentStage.PRELIMINARY) {
        prelimCount++;
        prelimMatches.push({
          match_label: `Prelim Match ${prelimCount}`,
          stage: m.stage,
          opponent_team: (opponent as any)?.name ?? 'BYE',
          result: isWinner ? 'Won' : 'Lost',
          team_points: myPts,
          opponent_points: oppPts,
        });
      } else {
        const stageLabel: Record<string, string> = {
          [TournamentStage.ROUND_OF_16]: 'Round of 16',
          [TournamentStage.QUARTER_FINAL]: 'Quarter-final',
          [TournamentStage.SEMI_FINAL]: 'Semi-final',
          [TournamentStage.FINAL]: 'Final',
        };
        bracketMatches.push({
          match_label: stageLabel[m.stage] ?? m.stage,
          stage: m.stage,
          opponent_team: (opponent as any)?.name ?? 'BYE',
          result: isWinner ? 'Won' : 'Lost',
          team_points: myPts,
          opponent_points: oppPts,
        });
      }
    });

    const matches = [...prelimMatches, ...bracketMatches];

    // Speaker breakdown
    const speakerBreakdown = team.members.map(member => ({
      name: member.fullName || `Speaker ${member.speakerOrder}`,
      total_points: member.totalSpeakerPoints ?? 0,
      matches_played: team.matchesPlayed,
      avg_points: team.matchesPlayed > 0
        ? Math.round(((member.totalSpeakerPoints ?? 0) / team.matchesPlayed) * 10) / 10
        : 0,
    }));

    return {
      team_id: teamId,
      team_name: team.name,
      total_points: team.totalPoints,
      team_rank: teamRank,
      team_rank_total: allTeams.length,
      status: getTeamStatus(teamId),
      prelim_count: prelimMatches.length,
      bracket_count: bracketMatches.length,
      matches,
      speakers: speakerBreakdown,
    };
  }));

  res.json({
    school_name: school.name,
    tournament_name: event.name,
    school_rank: schoolRank,
    school_rank_total: sortedSchools.length,
    total_speaker_points: totalSpeakerPoints,
    teams: teamsData,
    expires_at: access.expiresAt.toISOString(),
    generated_at: new Date().toISOString(),
  });
});

// @desc    Revoke a school access code
// @route   DELETE /api/v1/admin/school-access/:accessCode
// @access  Seed Admin only
export const revokeSchoolAccess = asyncHandler(async (req: Request, res: Response) => {
  const deleted = await TemporarySchoolAccess.findOneAndDelete({ accessCode: req.params.accessCode });
  if (!deleted) { res.status(404); throw new Error('Access code not found'); }
  res.json({ message: 'Access revoked' });
});
