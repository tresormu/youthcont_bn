import mongoose, { Schema, Document } from 'mongoose';

export enum TournamentStage {
  PRELIMINARY = 'Prelim',
  QUARTER_FINAL = 'QF',
  SEMI_FINAL = 'SF',
  FINAL = 'Final'
}

export interface IMatchup extends Document {
  event: mongoose.Types.ObjectId;
  schoolA: mongoose.Types.ObjectId;
  schoolB?: mongoose.Types.ObjectId; // Optional in case of byes or bracket placeholders
  stage: TournamentStage;
  bracketSlot?: number; // 0-3 for QF, 0-1 for SF, 0 for Final
}

const matchupSchema: Schema = new Schema({
  event: {
    type: Schema.Types.ObjectId,
    ref: 'Event',
    required: true
  },
  schoolA: {
    type: Schema.Types.ObjectId,
    ref: 'School',
    required: true
  },
  schoolB: {
    type: Schema.Types.ObjectId,
    ref: 'School'
  },
  stage: {
    type: String,
    enum: Object.values(TournamentStage),
    required: true
  },
  bracketSlot: {
    type: Number,
    default: null
  }
}, {
  timestamps: true
});

const Matchup = mongoose.model<IMatchup>('Matchup', matchupSchema);

export default Matchup;
