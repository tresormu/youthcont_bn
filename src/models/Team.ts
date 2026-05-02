import mongoose, { Schema, Document } from 'mongoose';

export interface ITeamMember {
  _id?: mongoose.Types.ObjectId;
  fullName: string;
  speakerOrder: number; // 1, 2, or 3
  totalSpeakerPoints?: number;
}

export interface ITeam extends Document {
  name: string;
  teamNumber: number;
  school: mongoose.Types.ObjectId;
  event: mongoose.Types.ObjectId;
  members: ITeamMember[];
  totalPoints: number;
  pointsConceded: number;
  matchesPlayed: number;
  matchesWon: number;
}

const teamMemberSchema = new Schema({
  fullName: { type: String, default: '' },
  speakerOrder: { type: Number, required: true, min: 1, max: 3 },
  totalSpeakerPoints: { type: Number, default: 0 }
});

const teamSchema: Schema = new Schema({
  name: {
    type: String,
    required: true
  },
  teamNumber: {
    type: Number,
    required: true
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
  },
  members: {
    type: [teamMemberSchema],
    validate: [
      {
        validator: (val: any[]) => val.length === 3,
        message: 'A team must have exactly 3 members.'
      }
    ]
  },
  totalPoints: {
    type: Number,
    default: 0
  },
  pointsConceded: {
    type: Number,
    default: 0
  },
  matchesPlayed: {
    type: Number,
    default: 0
  },
  matchesWon: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

teamSchema.index({ name: 1, school: 1, event: 1 }, { unique: true });

const Team = mongoose.model<ITeam>('Team', teamSchema);

export default Team;
