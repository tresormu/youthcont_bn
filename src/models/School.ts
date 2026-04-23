import mongoose, { Schema, Document } from 'mongoose';

export interface ISchool extends Document {
  name: string;
  region?: string;
  contactPerson?: string;
  contactEmail?: string;
  event: mongoose.Types.ObjectId;
}

const schoolSchema: Schema = new Schema({
  name: {
    type: String,
    required: true
  },
  region: {
    type: String
  },
  contactPerson: {
    type: String
  },
  contactEmail: {
    type: String
  },
  event: {
    type: Schema.Types.ObjectId,
    ref: 'Event',
    required: true
  }
}, {
  timestamps: true
});

schoolSchema.index({ name: 1, event: 1 }, { unique: true });

const School = mongoose.model<ISchool>('School', schoolSchema);

export default School;
