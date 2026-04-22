import { Request, Response } from 'express';
import asyncHandler from '../utils/asyncHandler';
import Team from '../models/Team';
import Match, { MatchStatus } from '../models/Match';
import { TournamentStage } from '../models/Matchup';
import ExcelJS from 'exceljs';

// Helper to get ranked data
async function getRankedData(eventId: string) {
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
      status: MatchStatus.COMPLETED,
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

  return ranked;
}

// @desc    Export full winners list as Excel (all teams ranked 1st to last)
// @route   GET /api/v1/events/:eventId/rankings/excel
// @access  Private
export const exportRankingsExcel = asyncHandler(async (req: Request, res: Response) => {
  const eventId = req.params.eventId as string;
  const data = await getRankedData(eventId);

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Winners List');

  sheet.columns = [
    { header: 'Rank', key: 'rank', width: 8 },
    { header: 'Team Name', key: 'teamName', width: 25 },
    { header: 'School', key: 'school', width: 25 },
    { header: 'Total Points', key: 'totalPoints', width: 14 },
    { header: 'Matches Played', key: 'matchesPlayed', width: 16 },
    { header: 'Matches Won', key: 'matchesWon', width: 14 },
    { header: 'Furthest Stage', key: 'furthestStage', width: 16 },
  ];

  // Style header row
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

  data.forEach(item => sheet.addRow(item));

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="winners-list-${eventId}.xlsx"`);

  await workbook.xlsx.write(res);
  res.end();
});
