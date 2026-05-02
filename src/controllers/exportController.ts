import { Request, Response } from 'express';
import asyncHandler from '../utils/asyncHandler';
import Team from '../models/Team';
import Match, { MatchStatus } from '../models/Match';
import SpeakerScore from '../models/SpeakerScore';
import { TournamentStage } from '../models/Matchup';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import Event from '../models/Event';
import School from '../models/School';
import TemporarySchoolAccess from '../models/TemporarySchoolAccess';

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 45;
const CONTENT_W = PAGE_W - MARGIN * 2;

async function getRankedData(eventId: string) {
  const teams = await Team.find({ event: eventId })
    .sort({ totalPoints: -1, matchesPlayed: 1 })
    .populate('school', 'name');

  const allMatches = await Match.find({
    event: eventId,
    status: MatchStatus.COMPLETED,
  }).select('stage winner teamA teamB');

  const stageOrder: Record<string, number> = {
    [TournamentStage.PRELIMINARY]: 1,
    [TournamentStage.ROUND_OF_16]: 2,
    [TournamentStage.QUARTER_FINAL]: 3,
    [TournamentStage.SEMI_FINAL]: 4,
    [TournamentStage.FINAL]: 5,
  };

  return teams.map((team, index) => {
    const teamId = team._id.toString();
    const teamMatches = allMatches.filter(
      m => m.teamA?.toString() === teamId || m.teamB?.toString() === teamId
    );

    let furthestStage = 'Preliminary';
    if (teamMatches.length > 0) {
      const best = teamMatches.reduce((prev, curr) =>
        (stageOrder[curr.stage] ?? 0) > (stageOrder[prev.stage] ?? 0) ? curr : prev
      );
      if (best.stage === TournamentStage.FINAL && best.winner?.toString() === teamId) {
        furthestStage = 'Champion';
      } else {
        const labels: Record<string, string> = {
          [TournamentStage.PRELIMINARY]: 'Preliminary',
          [TournamentStage.ROUND_OF_16]: 'Round of 16',
          [TournamentStage.QUARTER_FINAL]: 'Quarter-final',
          [TournamentStage.SEMI_FINAL]: 'Semi-final',
          [TournamentStage.FINAL]: 'Final',
        };
        furthestStage = labels[best.stage] ?? best.stage;
      }
    }

    return {
      rank: index + 1,
      teamName: team.name,
      school: (team.school as any)?.name ?? '',
      totalPoints: team.totalPoints,
      matchesPlayed: team.matchesPlayed,
      matchesWon: team.matchesWon,
      furthestStage,
    };
  });
}

// Draw a table row at absolute Y, returns the row height used
function drawRow(
  doc: InstanceType<typeof PDFDocument>,
  cols: { x: number; w: number; text: string; align?: 'left' | 'center' | 'right'; color?: string }[],
  y: number,
  rowH: number,
  bgColor?: string
) {
  if (bgColor) {
    doc.save().rect(MARGIN, y, CONTENT_W, rowH).fill(bgColor).restore();
  }
  cols.forEach(col => {
    doc.save()
      .fillColor(col.color ?? '#1e293b')
      .fontSize(8).font('Helvetica')
      .text(col.text, col.x, y + (rowH - 8) / 2, { width: col.w, align: col.align ?? 'left', lineBreak: false })
      .restore();
  });
}

function drawTableHeader(
  doc: InstanceType<typeof PDFDocument>,
  cols: { x: number; w: number; label: string }[],
  y: number,
  rowH: number = 20
) {
  doc.save().rect(MARGIN, y, CONTENT_W, rowH).fill('#1e293b').restore();
  cols.forEach(col => {
    doc.save()
      .fillColor('#ffffff')
      .fontSize(7.5).font('Helvetica-Bold')
      .text(col.label.toUpperCase(), col.x, y + (rowH - 7.5) / 2, { width: col.w, align: 'left', lineBreak: false })
      .restore();
  });
  return y + rowH;
}

function checkPageBreak(doc: InstanceType<typeof PDFDocument>, currentY: number, needed: number): number {
  if (currentY + needed > PAGE_H - MARGIN) {
    doc.addPage();
    return MARGIN + 20;
  }
  return currentY;
}

// @desc    Export rankings as PDF
// @route   GET /api/v1/events/:eventId/rankings/pdf
export const exportRankingsPDF = asyncHandler(async (req: Request, res: Response) => {
  const eventId = req.params.eventId as string;
  const [data, event] = await Promise.all([getRankedData(eventId), Event.findById(eventId)]);

  const doc = new PDFDocument({ margin: MARGIN, size: 'A4', autoFirstPage: true });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="rankings-${eventId}.pdf"`);
  doc.pipe(res);

  // ── Header banner ──
  doc.save().rect(0, 0, PAGE_W, 90).fill('#1e293b').restore();
  doc.fillColor('#ffffff').fontSize(22).font('Helvetica-Bold')
    .text(event?.name ?? 'Tournament', MARGIN, 22, { width: CONTENT_W, align: 'center' });
  doc.fillColor('#94a3b8').fontSize(10).font('Helvetica')
    .text('Official Team Rankings', MARGIN, 50, { width: CONTENT_W, align: 'center' });
  doc.fillColor('#64748b').fontSize(8)
    .text(`Generated: ${new Date().toLocaleString()}`, MARGIN, 68, { width: CONTENT_W, align: 'center' });

  let y = 110;

  // ── Table ──
  const ROW_H = 22;
  const cols = [
    { x: MARGIN + 4,   w: 28,  label: '#' },
    { x: MARGIN + 36,  w: 145, label: 'Team Name' },
    { x: MARGIN + 185, w: 130, label: 'School' },
    { x: MARGIN + 319, w: 55,  label: 'Points' },
    { x: MARGIN + 378, w: 45,  label: 'W / P' },
    { x: MARGIN + 427, w: 113, label: 'Furthest Stage' },
  ];

  y = drawTableHeader(doc, cols, y);

  data.forEach((row, idx) => {
    y = checkPageBreak(doc, y, ROW_H);
    const bg = idx % 2 === 0 ? '#f8fafc' : '#ffffff';
    const rankColor = idx === 0 ? '#b45309' : idx === 1 ? '#6b7280' : idx === 2 ? '#92400e' : '#1e293b';
    drawRow(doc, [
      { x: cols[0].x, w: cols[0].w, text: String(row.rank), color: rankColor },
      { x: cols[1].x, w: cols[1].w, text: row.teamName },
      { x: cols[2].x, w: cols[2].w, text: row.school },
      { x: cols[3].x, w: cols[3].w, text: String(row.totalPoints) },
      { x: cols[4].x, w: cols[4].w, text: `${row.matchesWon}/${row.matchesPlayed}` },
      { x: cols[5].x, w: cols[5].w, text: row.furthestStage },
    ], y, ROW_H, bg);
    y += ROW_H;
  });

  // border around table
  doc.save().rect(MARGIN, 110, CONTENT_W, y - 110).stroke('#e2e8f0').restore();

  // footer
  y += 20;
  doc.save().fillColor('#94a3b8').fontSize(8).font('Helvetica')
    .text(`Youth Contest  ·  ${data.length} teams  ·  Confidential`, MARGIN, y, { width: CONTENT_W, align: 'center' })
    .restore();

  doc.end();
});

// @desc    Export rankings as Excel
// @route   GET /api/v1/events/:eventId/rankings/excel
export const exportRankingsExcel = asyncHandler(async (req: Request, res: Response) => {
  const eventId = req.params.eventId as string;
  const [data, event] = await Promise.all([getRankedData(eventId), Event.findById(eventId)]);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Youth Contest';
  const sheet = workbook.addWorksheet('Rankings', { views: [{ state: 'frozen', ySplit: 3 }] });

  // Title rows
  sheet.mergeCells('A1:G1');
  sheet.getCell('A1').value = event?.name ?? 'Tournament Rankings';
  sheet.getCell('A1').font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
  sheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1e293b' } };
  sheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getRow(1).height = 30;

  sheet.mergeCells('A2:G2');
  sheet.getCell('A2').value = `Generated: ${new Date().toLocaleString()}`;
  sheet.getCell('A2').font = { italic: true, size: 9, color: { argb: 'FF64748b' } };
  sheet.getCell('A2').alignment = { horizontal: 'center' };
  sheet.getRow(2).height = 18;

  // Header row
  sheet.columns = [
    { key: 'rank',         width: 7  },
    { key: 'teamName',     width: 28 },
    { key: 'school',       width: 28 },
    { key: 'totalPoints',  width: 14 },
    { key: 'matchesPlayed',width: 16 },
    { key: 'matchesWon',   width: 14 },
    { key: 'furthestStage',width: 20 },
  ];

  const headerRow = sheet.getRow(3);
  headerRow.values = ['#', 'Team Name', 'School', 'Points', 'Played', 'Won', 'Furthest Stage'];
  headerRow.eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = { bottom: { style: 'thin', color: { argb: 'FF475569' } } };
  });
  headerRow.height = 22;

  // Data rows
  data.forEach((item, idx) => {
    const row = sheet.addRow([
      item.rank, item.teamName, item.school,
      item.totalPoints, item.matchesPlayed, item.matchesWon, item.furthestStage,
    ]);
    const isEven = idx % 2 === 0;
    const bg = isEven ? 'FFF8FAFC' : 'FFFFFFFF';
    row.eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = { bottom: { style: 'hair', color: { argb: 'FFE2E8F0' } } };
    });
    // Highlight top 3
    if (item.rank <= 3) {
      const colors = ['FFFEF3C7', 'FFF1F5F9', 'FFFEF9EE'];
      row.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors[item.rank - 1] } };
      });
    }
    row.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' };
    row.getCell(3).alignment = { horizontal: 'left', vertical: 'middle' };
    row.height = 18;
  });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="rankings-${eventId}.xlsx"`);
  await workbook.xlsx.write(res);
  res.end();
});

// @desc    Export school report as PDF
// @route   GET /api/v1/school-report/export/pdf
export const exportSchoolReportPDF = asyncHandler(async (req: Request, res: Response) => {
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
  if (!school || !event) { res.status(404); throw new Error('Not found'); }

  const schoolTeams = allTeams.filter(t => t.school.toString() === schoolId.toString());

  // Only completed matches — pending prelims are scheduling artifacts
  const allMatches = await Match.find({ event: eventId, status: MatchStatus.COMPLETED })
    .populate('teamA', '_id name')
    .populate('teamB', '_id name')
    .populate('winner', '_id');

  // School rank
  const schoolPointsMap = new Map<string, number>();
  for (const t of allTeams) {
    const sid = t.school.toString();
    schoolPointsMap.set(sid, (schoolPointsMap.get(sid) ?? 0) + t.totalPoints);
  }
  const sortedSchools = [...schoolPointsMap.entries()].sort((a, b) => b[1] - a[1]);
  const schoolRank = sortedSchools.findIndex(([sid]) => sid === schoolId.toString()) + 1;
  const totalPoints = schoolTeams.reduce((s, t) => s + t.totalPoints, 0);

  const doc = new PDFDocument({ margin: MARGIN, size: 'A4', autoFirstPage: true });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition',
    `attachment; filename="school-report-${school.name.replace(/\s+/g, '-')}.pdf"`);
  doc.pipe(res);

  // ── Cover banner ──
  doc.save().rect(0, 0, PAGE_W, 110).fill('#1e293b').restore();
  doc.fillColor('#94a3b8').fontSize(9).font('Helvetica')
    .text('SCHOOL PERFORMANCE REPORT', MARGIN, 20, { width: CONTENT_W, align: 'center', characterSpacing: 2 });
  doc.fillColor('#ffffff').fontSize(20).font('Helvetica-Bold')
    .text(event.name, MARGIN, 34, { width: CONTENT_W, align: 'center' });
  doc.fillColor('#e2e8f0').fontSize(13).font('Helvetica')
    .text(school.name, MARGIN, 62, { width: CONTENT_W, align: 'center' });
  doc.fillColor('#64748b').fontSize(8)
    .text(
      `Generated: ${new Date().toLocaleString()}   ·   Expires: ${access.expiresAt.toLocaleString()}`,
      MARGIN, 88, { width: CONTENT_W, align: 'center' }
    );

  let y = 128;

  // ── Summary cards ──
  const cardW = (CONTENT_W - 10) / 2;
  // Card 1 — School Rank
  doc.save().roundedRect(MARGIN, y, cardW, 52, 6).fill('#f0f9ff').restore();
  doc.save().fillColor('#0369a1').fontSize(8).font('Helvetica-Bold')
    .text('SCHOOL RANK', MARGIN + 12, y + 10, { width: cardW - 24, characterSpacing: 1 }).restore();
  doc.save().fillColor('#0c4a6e').fontSize(22).font('Helvetica-Bold')
    .text(`#${schoolRank}`, MARGIN + 12, y + 22, { width: 60 }).restore();
  doc.save().fillColor('#64748b').fontSize(8).font('Helvetica')
    .text(`out of ${sortedSchools.length} schools`, MARGIN + 12 + 48, y + 30, { width: cardW - 70 }).restore();

  // Card 2 — Total Points
  const c2x = MARGIN + cardW + 10;
  doc.save().roundedRect(c2x, y, cardW, 52, 6).fill('#f0fdf4').restore();
  doc.save().fillColor('#15803d').fontSize(8).font('Helvetica-Bold')
    .text('TOTAL SPEAKER POINTS', c2x + 12, y + 10, { width: cardW - 24, characterSpacing: 1 }).restore();
  doc.save().fillColor('#14532d').fontSize(22).font('Helvetica-Bold')
    .text(String(totalPoints), c2x + 12, y + 22, { width: cardW - 24 }).restore();

  y += 64;

  // ── Teams ──
  for (const team of schoolTeams) {
    const teamId = team._id.toString();
    const teamRank = allTeams.findIndex(t => t._id.toString() === teamId) + 1;

    // Team header bar
    y = checkPageBreak(doc, y, 30);
    doc.save().rect(MARGIN, y, CONTENT_W, 26).fill('#334155').restore();
    doc.save().fillColor('#ffffff').fontSize(10).font('Helvetica-Bold')
      .text(team.name, MARGIN + 10, y + 7, { width: CONTENT_W * 0.55 }).restore();
    doc.save().fillColor('#94a3b8').fontSize(8).font('Helvetica')
      .text(`Rank #${teamRank} / ${allTeams.length}   ·   ${team.totalPoints} pts`, MARGIN + 10, y + 9 + 8, { width: CONTENT_W * 0.55 }).restore();
    // right side rank badge
    doc.save().fillColor('#f59e0b').fontSize(18).font('Helvetica-Bold')
      .text(`#${teamRank}`, MARGIN + CONTENT_W - 55, y + 3, { width: 50, align: 'right' }).restore();
    y += 30;

    // Match history
    const getId = (ref: any): string => ref?._id?.toString() ?? ref?.toString() ?? '';
    const teamMatches = allMatches.filter(
      m => getId(m.teamA) === teamId || getId(m.teamB) === teamId
    );
    const stageOrderMap: Record<string, number> = {
      [TournamentStage.PRELIMINARY]: 0, [TournamentStage.ROUND_OF_16]: 1,
      [TournamentStage.QUARTER_FINAL]: 2, [TournamentStage.SEMI_FINAL]: 3, [TournamentStage.FINAL]: 4,
    };
    teamMatches.sort((a, b) => (stageOrderMap[a.stage] ?? 0) - (stageOrderMap[b.stage] ?? 0));

    const prelimMatches = teamMatches.filter(m => m.stage === TournamentStage.PRELIMINARY);
    const bracketMatches = teamMatches.filter(m => m.stage !== TournamentStage.PRELIMINARY);

    const mCols = [
      { x: MARGIN + 4,   w: 90,  label: 'Round' },
      { x: MARGIN + 98,  w: 165, label: 'Opponent' },
      { x: MARGIN + 267, w: 50,  label: 'Result' },
      { x: MARGIN + 321, w: 55,  label: 'Our Pts' },
      { x: MARGIN + 380, w: 55,  label: 'Opp Pts' },
      { x: MARGIN + 439, w: 66,  label: 'Margin' },
    ];
    const MROW_H = 20;

    const renderMatchSection = (matches: typeof teamMatches, sectionTitle: string, labelFn: (m: typeof teamMatches[0], i: number) => string) => {
      if (matches.length === 0) return;
      y = checkPageBreak(doc, y, 20);
      doc.save().fillColor('#475569').fontSize(7.5).font('Helvetica-Bold')
        .text(sectionTitle, MARGIN + 4, y + 4, { characterSpacing: 1 }).restore();
      y += 16;
      y = checkPageBreak(doc, y, 18);
      y = drawTableHeader(doc, mCols, y, 18);
      matches.forEach((m, idx) => {
        y = checkPageBreak(doc, y, MROW_H);
        const isCompleted = m.status === MatchStatus.COMPLETED;
        const isWinner = isCompleted && getId(m.winner) === teamId;
        const isTeamA = getId(m.teamA) === teamId;
        const opponent = isTeamA ? m.teamB : m.teamA;
        const myPts = isCompleted ? (isWinner ? (m.winnerSpeakerPoints ?? 0) : (m.loserSpeakerPoints ?? 0)) : 0;
        const oppPts = isCompleted ? (isWinner ? (m.loserSpeakerPoints ?? 0) : (m.winnerSpeakerPoints ?? 0)) : 0;
        const margin = myPts - oppPts;
        const bg = idx % 2 === 0 ? '#f8fafc' : '#ffffff';
        drawRow(doc, [
          { x: mCols[0].x, w: mCols[0].w, text: labelFn(m, idx) },
          { x: mCols[1].x, w: mCols[1].w, text: (opponent as any)?.name ?? 'BYE' },
          { x: mCols[2].x, w: mCols[2].w,
            text: isCompleted ? (isWinner ? 'Won' : 'Lost') : 'Pending',
            color: isCompleted ? (isWinner ? '#16a34a' : '#dc2626') : '#94a3b8' },
          { x: mCols[3].x, w: mCols[3].w, text: isCompleted ? String(myPts) : '-' },
          { x: mCols[4].x, w: mCols[4].w, text: isCompleted ? String(oppPts) : '-' },
          { x: mCols[5].x, w: mCols[5].w,
            text: isCompleted ? (margin >= 0 ? `+${margin}` : String(margin)) : '-',
            color: isCompleted ? (margin >= 0 ? '#16a34a' : '#dc2626') : '#94a3b8' },
        ], y, MROW_H, bg);
        y += MROW_H;
      });
      doc.save().rect(MARGIN, y - matches.length * MROW_H - 18, CONTENT_W, matches.length * MROW_H + 18)
        .stroke('#e2e8f0').restore();
    };

    if (prelimMatches.length > 0) {
      renderMatchSection(prelimMatches, 'PRELIMINARY ROUNDS', (_m, i) => `Match ${i + 1}`);
    } else {
      y = checkPageBreak(doc, y, 18);
      doc.save().fillColor('#94a3b8').fontSize(8).font('Helvetica')
        .text('No preliminary matches recorded.', MARGIN + 4, y + 4).restore();
      y += 18;
    }
    if (bracketMatches.length > 0) {
      y += 6;
      const bracketLabel: Record<string, string> = {
        [TournamentStage.ROUND_OF_16]: 'Round of 16',
        [TournamentStage.QUARTER_FINAL]: 'Quarter-final',
        [TournamentStage.SEMI_FINAL]: 'Semi-final',
        [TournamentStage.FINAL]: 'Final',
      };
      renderMatchSection(bracketMatches, 'KNOCKOUT STAGE', (m) => bracketLabel[m.stage] ?? m.stage);
    }

    // Per-round speaker scores for this team
    const memberIds = team.members.map(m => m._id);
    const speakerDocs = await SpeakerScore.find({
      event: eventId,
      memberId: { $in: memberIds },
    }).lean();

    if (team.members.length > 0) {
      y = checkPageBreak(doc, y, 16 + (team.members.length + 1) * 18);
      y += 6;
      doc.save().fillColor('#475569').fontSize(7.5).font('Helvetica-Bold')
        .text('SPEAKER BREAKDOWN', MARGIN + 4, y, { characterSpacing: 1 }).restore();
      y += 14;

      const sCols = [
        { x: MARGIN + 4,   w: 140, label: 'Speaker' },
        { x: MARGIN + 148, w: 50,  label: 'Round 1' },
        { x: MARGIN + 202, w: 50,  label: 'Round 2' },
        { x: MARGIN + 256, w: 50,  label: 'Round 3' },
        { x: MARGIN + 310, w: 60,  label: 'Total' },
        { x: MARGIN + 374, w: 60,  label: 'Avg / Match' },
      ];
      y = checkPageBreak(doc, y, 16);
      y = drawTableHeader(doc, sCols, y, 16);

      let teamSpeakerTotal = 0;
      team.members.forEach((member, idx) => {
        y = checkPageBreak(doc, y, 18);
        const mId = member._id?.toString();
        const mScores = speakerDocs.filter((s: any) => s.memberId.toString() === mId);
        const r1 = mScores.find((s: any) => s.roundNumber === 1)?.pointsScored ?? 0;
        const r2 = mScores.find((s: any) => s.roundNumber === 2)?.pointsScored ?? 0;
        const r3 = mScores.find((s: any) => s.roundNumber === 3)?.pointsScored ?? 0;
        const total = member.totalSpeakerPoints ?? 0;
        teamSpeakerTotal += total;
        const matchCount = mScores.length;
        const avg = matchCount > 0 ? Math.round((total / matchCount) * 10) / 10 : 0;
        drawRow(doc, [
          { x: sCols[0].x, w: sCols[0].w, text: member.fullName || `Speaker ${member.speakerOrder}` },
          { x: sCols[1].x, w: sCols[1].w, text: r1 > 0 ? String(r1) : '—' },
          { x: sCols[2].x, w: sCols[2].w, text: r2 > 0 ? String(r2) : '—' },
          { x: sCols[3].x, w: sCols[3].w, text: r3 > 0 ? String(r3) : '—' },
          { x: sCols[4].x, w: sCols[4].w, text: String(total), color: '#0369a1' },
          { x: sCols[5].x, w: sCols[5].w, text: String(avg) },
        ], y, 18, idx % 2 === 0 ? '#f8fafc' : '#ffffff');
        y += 18;
      });

      // Team speaker total row
      y = checkPageBreak(doc, y, 18);
      doc.save().rect(MARGIN, y, CONTENT_W, 18).fill('#e0f2fe').restore();
      doc.save().fillColor('#0369a1').fontSize(8).font('Helvetica-Bold')
        .text('Team Speaker Total', sCols[0].x, y + 5, { width: sCols[0].w }).restore();
      doc.save().fillColor('#0369a1').fontSize(8).font('Helvetica-Bold')
        .text(String(teamSpeakerTotal), sCols[4].x, y + 5, { width: sCols[4].w }).restore();
      y += 18;
    }

    y += 16;
  }

  // ── School Grand Total ──
  const allMemberIds = schoolTeams.flatMap(t => t.members.map(m => m._id));
  const allSpeakerDocs = await SpeakerScore.find({ event: eventId, memberId: { $in: allMemberIds } }).lean();
  const grandTotal = allSpeakerDocs.reduce((s: number, d: any) => s + (d.pointsScored ?? 0), 0);

  y = checkPageBreak(doc, y, 36);
  doc.save().rect(MARGIN, y, CONTENT_W, 30).fill('#1e293b').restore();
  doc.save().fillColor('#94a3b8').fontSize(8).font('Helvetica-Bold')
    .text('GRAND TOTAL — ALL SPEAKER POINTS FOR THIS SCHOOL', MARGIN + 12, y + 6, { characterSpacing: 1 }).restore();
  doc.save().fillColor('#ffffff').fontSize(16).font('Helvetica-Bold')
    .text(String(grandTotal), MARGIN + 12, y + 10, { width: CONTENT_W - 24, align: 'right' }).restore();
  y += 38;

  // ── Footer ──
  y = checkPageBreak(doc, y, 30);
  doc.save().rect(MARGIN, y, CONTENT_W, 1).fill('#e2e8f0').restore();
  y += 8;
  doc.save().fillColor('#94a3b8').fontSize(8).font('Helvetica')
    .text(
      `Youth Contest  ·  ${school.name}  ·  Confidential  ·  Expires ${access.expiresAt.toLocaleString()}`,
      MARGIN, y, { width: CONTENT_W, align: 'center' }
    ).restore();

  doc.end();
});
