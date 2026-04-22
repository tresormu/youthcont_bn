import mongoose, { Schema, Document } from 'mongoose';

export enum ContactStatus {
  NEW = 'New',
  READ = 'Read',
  RESOLVED = 'Resolved',
}

export enum ContactReason {
  GENERAL_INQUIRY = 'General Inquiry',
  REGISTRATION_HELP = 'Registration Help',
  TECHNICAL_ISSUE = 'Technical Issue',
  PARTNERSHIP = 'Partnership',
  OTHER = 'Other',
}

export interface IContactMessage extends Document {
  email: string;
  phone: string;
  reason: ContactReason;
  message: string;
  status: ContactStatus;
}

const contactMessageSchema: Schema = new Schema(
  {
    email: { type: String, required: true },
    phone: { type: String, required: true },
    reason: { type: String, enum: Object.values(ContactReason), required: true },
    message: { type: String, required: true },
    status: { type: String, enum: Object.values(ContactStatus), default: ContactStatus.NEW },
  },
  { timestamps: true }
);

const ContactMessage = mongoose.model<IContactMessage>('ContactMessage', contactMessageSchema);

export default ContactMessage;
