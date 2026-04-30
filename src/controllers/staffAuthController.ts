import { Request, Response } from 'express';
import asyncHandler from '../utils/asyncHandler';
import User from '../models/User';
import bcrypt from 'bcryptjs';
import generateToken from '../utils/generateToken';
import config from '../config/config';

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

  // Account not yet activated — redirect to PIN verification
  if (!user.isActive && user.pinCode) {
    res.status(403).json({ message: 'Account not activated. PIN verification required.', requiresActivation: true });
    return;
  }

  // Deactivated by admin (no pinCode means it was previously active)
  if (!user.isActive) {
    res.status(401);
    throw new Error('Account is deactivated');
  }

  generateToken(res, (user._id as any).toString());

  res.json({
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
  });
});

// @desc    Activate account — verify PIN, set password, mark active
// @route   POST /api/v1/staff/auth/activate
// @access  Public
export const staffActivate = asyncHandler(async (req: Request, res: Response) => {
  const { email, pinCode, newPassword } = req.body;

  if (!email || !pinCode || !newPassword) {
    res.status(400);
    throw new Error('email, pinCode, and newPassword are required');
  }

  if (newPassword.length < 8) {
    res.status(400);
    throw new Error('newPassword must be at least 8 characters');
  }

  const user = await User.findOne({ email, role: 'staff' });

  if (!user) {
    res.status(404);
    throw new Error('No staff account found with this email');
  }

  if (user.isActive || !user.pinCode) {
    res.status(400);
    throw new Error('This account is already activated');
  }

  const pinMatches = await bcrypt.compare(pinCode, user.pinCode);
  if (!pinMatches) {
    res.status(401);
    throw new Error('Invalid PIN code');
  }

  user.passwordHash = await bcrypt.hash(newPassword, 12);
  user.pinCode = undefined;
  user.isActive = true;
  await user.save();

  generateToken(res, (user._id as any).toString());

  res.json({
    _id: user._id,
    email: user.email,
    role: user.role,
    message: 'Account activated successfully',
  });
});

// @desc    Change password (for already-active staff)
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
  const isProd = config.nodeEnv !== 'development';
  res.cookie('jwt', '', {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    expires: new Date(0),
  });
  res.json({ message: 'Logged out successfully' });
});
