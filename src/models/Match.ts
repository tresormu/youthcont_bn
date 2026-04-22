import mongoose, { Schema, Document } from 'mongoose';
import { TournamentStage } from './Matchup';

export enum MatchStatus {
  PENDING = 'Pending',
  IN_PROGRESS = 'In Progress',
  COMPLETED = 'Completed'
}

export interface IMatch extends Document {
  matchup: mongoose.Types.ObjectId;
  event: mongoose.Types.ObjectId;
  teamA: mongoose.Types.ObjectId;
  teamB?: mongoose.Types.ObjectId; // Optional for byes
  winner?: mongoose.Types.ObjectId;
  status: MatchStatus;
  stage: TournamentStage;
  bracketSlot?: number;
  scoredBy?: mongoose.Types.ObjectId;
  scoredAt?: Date;
}

const matchSchema: Schema = new Schema({
  matchup: {
    type: Schema.Types.ObjectId,
    ref: 'Matchup',
    required: true
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
  timestamps: true
});

const Match = mongoose.model<IMatch>('Match', matchSchema);

export default Match;
