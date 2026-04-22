import mongoose, { Schema, Document } from 'mongoose';

export interface IPublicSpeaker extends Document {
  fullName: string;
  speakerNumber: number; // 1-5
  school: mongoose.Types.ObjectId;
  event: mongoose.Types.ObjectId;
}

const publicSpeakerSchema: Schema = new Schema({
  fullName: {
    type: String,
    required: true
  },
  speakerNumber: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  school: {
    type: Schema.Types.ObjectId,
    ref: 'School',
    required: true
  },
  event: {
    type: Schema.Types.ObjectId,
    ref: 'Event',
    required: true
  }
}, {
  timestamps: true
});

const PublicSpeaker = mongoose.model<IPublicSpeaker>('PublicSpeaker', publicSpeakerSchema);

export default PublicSpeaker;
