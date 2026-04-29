import { Request, Response } from 'express';
import asyncHandler from '../utils/asyncHandler';
import User from '../models/User';

// @desc    Get all staff members
// @route   GET /api/v1/staff
// @access  Seed Admin only
export const getStaff = asyncHandler(async (_req: Request, res: Response) => {
  const staff = await User.find({ role: 'staff' }).select('-passwordHash -pinCode').sort({ createdAt: -1 });
  const result = staff.map((s) => ({
    _id: s._id,
    name: s.name,
    email: s.email,
    role: s.role,
    isActive: s.isActive,
    pendingActivation: !s.isActive && !!s.pinCode,
    createdAt: (s as any).createdAt,
  }));
  res.json(result);
});

// @desc    Update staff member details
// @route   PATCH /api/v1/staff/:id
// @access  Seed Admin only
export const updateStaff = asyncHandler(async (req: Request, res: Response) => {
  const staff = await User.findById(req.params.id);

  if (!staff) {
    res.status(404);
    throw new Error('Staff member not found');
  }

  if (staff.role === 'seed_admin') {
    res.status(403);
    throw new Error('Cannot modify the seed admin account');
  }

  const { name, email } = req.body;
  if (name) staff.name = name;
  if (email) {
    const emailTaken = await User.findOne({ email, _id: { $ne: staff._id } });
    if (emailTaken) {
      res.status(409);
      throw new Error('Email already in use');
    }
    staff.email = email;
  }

  const updated = await staff.save();
  res.json({ _id: updated._id, name: updated.name, email: updated.email, role: updated.role, isActive: updated.isActive });
});

// @desc    Deactivate (soft-delete) a staff member
// @route   DELETE /api/v1/staff/:id
// @access  Seed Admin only
export const deactivateStaff = asyncHandler(async (req: Request, res: Response) => {
  const staff = await User.findById(req.params.id);

  if (!staff) {
    res.status(404);
    throw new Error('Staff member not found');
  }

  if (staff.role === 'seed_admin') {
    res.status(403);
    throw new Error('Cannot deactivate the seed admin account');
  }

  staff.isActive = false;
  await staff.save();

  res.json({ message: `Staff member "${staff.name}" has been deactivated` });
});
