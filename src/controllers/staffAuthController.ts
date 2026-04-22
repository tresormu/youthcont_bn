import { Request, Response } from 'express';
import asyncHandler from '../utils/asyncHandler';
import User from '../models/User';
import bcrypt from 'bcryptjs';
import generateToken from '../utils/generateToken';

// @desc    Staff login
// @route   POST /api/v1/staff/auth/login
// @access  Public
export const staffLogin = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400);
    throw new Error('email and password are required');
  }

  const user = await User.findOne({ email, role: 'staff' });

  if (!user || !(await user.matchPassword(password))) {
    res.status(401);
    throw new Error('Invalid email or password');
  }

  if (!user.isActive) {
    res.status(401);
    throw new Error('Account is deactivated');
  }

  // Block login until PIN is verified
  if (user.pinCode) {
    res.status(403).json({ message: 'PIN verification required', requiresPinVerification: true });
    return;
  }

  generateToken(res, (user._id as any).toString());

  res.json({
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
  });
});

// @desc    Verify PIN and get token (first-time staff login)
// @route   POST /api/v1/staff/auth/verify-pin
// @access  Public
export const staffVerifyPin = asyncHandler(async (req: Request, res: Response) => {
  const { email, password, pinCode } = req.body;

  if (!email || !password || !pinCode) {
    res.status(400);
    throw new Error('email, password, and pinCode are required');
  }

  const user = await User.findOne({ email, role: 'staff' });

  if (!user || !(await user.matchPassword(password))) {
    res.status(401);
    throw new Error('Invalid credentials');
  }

  if (!user.isActive) {
    res.status(401);
    throw new Error('Account is deactivated');
  }

  if (!user.pinCode) {
    res.status(400);
    throw new Error('No PIN verification pending for this account');
  }

  const pinMatches = await bcrypt.compare(pinCode, user.pinCode);
  if (!pinMatches) {
    res.status(401);
    throw new Error('Invalid PIN code');
  }

  user.pinCode = undefined;
  await user.save();

  generateToken(res, (user._id as any).toString());

  res.json({
    _id: user._id,
    email: user.email,
    role: user.role,
  });
});

// @desc    Change password
// @route   PATCH /api/v1/staff/auth/change-password
// @access  Private (staff)
export const staffChangePassword = asyncHandler(async (req: Request, res: Response) => {
  const { newPassword } = req.body;

  if (!newPassword || newPassword.length < 8) {
    res.status(400);
    throw new Error('newPassword must be at least 8 characters');
  }

  const user = await User.findById(req.user?._id);
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  user.passwordHash = await bcrypt.hash(newPassword, 12);
  await user.save();

  res.json({ message: 'Password updated successfully' });
});

// @desc    Staff logout
// @route   POST /api/v1/staff/auth/logout
// @access  Private (staff)
export const staffLogout = asyncHandler(async (_req: Request, res: Response) => {
  res.cookie('jwt', '', { httpOnly: true, expires: new Date(0) });
  res.json({ message: 'Logged out successfully' });
});
