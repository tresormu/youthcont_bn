import mongoose, { Schema, Document } from 'mongoose';

export interface ISpeakerScoreDoc extends Document {
  memberId: mongoose.Types.ObjectId;
  matchId: mongoose.Types.ObjectId;
  roundNumber: number;
  pointsScored: number;
  event: mongoose.Types.ObjectId;
}

const speakerScoreSchema: Schema = new Schema({
  memberId: { type: Schema.Types.ObjectId, required: true },
  matchId: { type: Schema.Types.ObjectId, ref: 'Match', required: true },
  roundNumber: { type: Number, required: true },
  pointsScored: { type: Number, required: true, max: 30 },
  event: { type: Schema.Types.ObjectId, ref: 'Event', required: true }
}, {
  timestamps: true
});

speakerScoreSchema.index({ memberId: 1, matchId: 1 }, { unique: true });
speakerScoreSchema.index({ event: 1 });

const SpeakerScore = mongoose.model<ISpeakerScoreDoc>('SpeakerScore', speakerScoreSchema);

export default SpeakerScore;
