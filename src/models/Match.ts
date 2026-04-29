import mongoose, { Schema, Document } from 'mongoose';
import { TournamentStage } from './Matchup';

export enum MatchStatus {
  PENDING = 'Pending',
  IN_PROGRESS = 'In Progress',
  COMPLETED = 'Completed'
}

export interface ISpeakerScore {
  memberId: mongoose.Types.ObjectId;
  points: number;
}

export interface IMatch extends Document {
  matchup?: mongoose.Types.ObjectId;
  event: mongoose.Types.ObjectId;
  teamA: mongoose.Types.ObjectId;
  teamB?: mongoose.Types.ObjectId; // Optional for byes
  winner?: mongoose.Types.ObjectId;
  loser?: mongoose.Types.ObjectId;
  winnerSpeakerPoints?: number;
  loserSpeakerPoints?: number;
  teamASpeakerScores?: ISpeakerScore[];
  teamBSpeakerScores?: ISpeakerScore[];
  status: MatchStatus;
  stage: TournamentStage;
  bracketSlot?: number;
  scoredBy?: mongoose.Types.ObjectId;
  scoredAt?: Date;
}

const speakerScoreSchema = new Schema({
  memberId: { type: Schema.Types.ObjectId, required: true },
  points: { type: Number, required: true, min: 0 }
}, { _id: false });

const matchSchema: Schema = new Schema({
  matchup: {
    type: Schema.Types.ObjectId,
    ref: 'Matchup'
  },
  event: {
    type: Schema.Types.ObjectId,
    ref: 'Event',
    required: true
  },
  teamA: {
    type: Schema.Types.ObjectId,
    ref: 'Team',
    required: true
  },
  teamB: {
    type: Schema.Types.ObjectId,
    ref: 'Team'
  },
  winner: {
    type: Schema.Types.ObjectId,
    ref: 'Team'
  },
  loser: {
    type: Schema.Types.ObjectId,
    ref: 'Team'
  },
  winnerSpeakerPoints: {
    type: Number,
    default: 0
  },
  loserSpeakerPoints: {
    type: Number,
    default: 0
  },
  teamASpeakerScores: {
    type: [speakerScoreSchema],
    default: []
  },
  teamBSpeakerScores: {
    type: [speakerScoreSchema],
    default: []
  },
  status: {
    type: String,
    enum: Object.values(MatchStatus),
    default: MatchStatus.PENDING
  },
  stage: {
    type: String,
    enum: Object.values(TournamentStage),
    required: true
  },
  bracketSlot: {
    type: Number,
    default: null
  },
  scoredBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  scoredAt: {
    type: Date
  }
}, {
  timestamps: true,
  optimisticConcurrency: true,
});

const Match = mongoose.model<IMatch>('Match', matchSchema);

matchSchema.index({ event: 1, stage: 1 });
matchSchema.index({ event: 1, stage: 1, status: 1 });
matchSchema.index({ teamA: 1 });
matchSchema.index({ teamB: 1 });

export default Match;
