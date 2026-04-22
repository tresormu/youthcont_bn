import mongoose, { Schema, Document } from 'mongoose';

export enum EventStatus {
  DRAFT = 'Draft',
  REGISTRATION_OPEN = 'Registration Open',
  PRELIMINARY_ROUNDS = 'Preliminary Rounds',
  BRACKET_STAGE = 'Bracket Stage',
  COMPLETED = 'Completed'
}

export interface IEvent extends Document {
  name: string;
  edition?: string;
  description?: string;
  date?: Date;
  status: EventStatus;
  createdBy: mongoose.Types.ObjectId;
}

const eventSchema: Schema = new Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  edition: {
    type: String
  },
  description: {
    type: String
  },
  date: {
    type: Date
  },
  status: {
    type: String,
    enum: Object.values(EventStatus),
    default: EventStatus.DRAFT
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

const Event = mongoose.model<IEvent>('Event', eventSchema);

export default Event;
