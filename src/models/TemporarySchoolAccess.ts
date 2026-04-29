import mongoose, { Schema, Document } from 'mongoose';

export interface ITemporarySchoolAccess extends Document {
  email: string;
  school: mongoose.Types.ObjectId;
  event: mongoose.Types.ObjectId;
  accessCode: string;
  expiresAt: Date;
  used: boolean;
}

const schema: Schema = new Schema({
  email: { type: String, required: true },
  school: { type: Schema.Types.ObjectId, ref: 'School', required: true },
  event: { type: Schema.Types.ObjectId, ref: 'Event', required: true },
  accessCode: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true },
  used: { type: Boolean, default: false },
}, { timestamps: true });

schema.index({ email: 1, accessCode: 1 });

const TemporarySchoolAccess = mongoose.model<ITemporarySchoolAccess>('TemporarySchoolAccess', schema);
export default TemporarySchoolAccess;
