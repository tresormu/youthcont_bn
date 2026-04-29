import { Request, Response } from 'express';
import asyncHandler from '../utils/asyncHandler';
import User from '../models/User';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import mongoose from 'mongoose';
import config from '../config/config';
import { sendStaffInviteEmail } from '../utils/sendEmail';

const generateAlphanumericPin = (): string =>
  crypto.randomBytes(6).toString('base64url').slice(0, 6).toUpperCase();

// @desc    Invite a new staff member by email
// @route   POST /api/v1/admin/staff
// @access  Seed Admin only
export const createStaff = asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body;

  if (!email) {
    res.status(400);
    throw new Error('email is required');
  }

  const exists = await User.findOne({ email });
  if (exists) {
    res.status(409);
    throw new Error('A user with this email already exists');
  }

  const seedPassword = config.staff.seedPassword;
  const pinCode = generateAlphanumericPin();

  const passwordHash = await bcrypt.hash(seedPassword, 12);
  const pinHash = await bcrypt.hash(pinCode, 10);

  const session = await mongoose.startSession();
  let staff;
  try {
    session.startTransaction();
    staff = await User.create([{
      name: '',
      email,
      passwordHash,
      pinCode: pinHash,
      role: 'staff',
      isActive: false,
    }], { session });

    await sendStaffInviteEmail(email, pinCode);
    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }

  res.status(201).json({
    _id: staff[0]._id,
    email: staff[0].email,
    role: staff[0].role,
    message: 'Staff member invited. Credentials sent via email.',
  });
});
