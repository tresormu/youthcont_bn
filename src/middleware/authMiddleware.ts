import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import User, { IUser } from '../models/User';
import config from '../config/config';

interface DecodedToken {
  userId: string;
}

interface SchoolOwnerToken {
  schoolId: string;
  eventId: string;
  role: 'school_owner';
  accessId: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: IUser;
      schoolOwner?: SchoolOwnerToken;
    }
  }
}

export const protect = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const token = req.cookies.jwt;

  if (!token) {
    res.status(401).json({ message: 'Not authorized, no token' });
    return;
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret) as DecodedToken;
    const user = await User.findById(decoded.userId).select('-passwordHash');

    if (!user || !user.isActive) {
      res.status(401).json({ message: 'Not authorized, user not found or inactive' });
      return;
    }

    req.user = user;
    next();
  } catch {
    res.status(401).json({ message: 'Not authorized, token invalid' });
  }
};

export const adminOnly = (req: Request, res: Response, next: NextFunction): void => {
  if (req.user?.role === 'seed_admin') {
    next();
  } else {
    res.status(403).json({ message: 'Access denied: seed admin only' });
  }
};

export const schoolOwnerAuth = (req: Request, res: Response, next: NextFunction): void => {
  const token = req.cookies.school_jwt;
  if (!token) {
    res.status(401).json({ message: 'Not authorized' });
    return;
  }
  try {
    const decoded = jwt.verify(token, config.jwtSecret) as SchoolOwnerToken;
    if (decoded.role !== 'school_owner') {
      res.status(403).json({ message: 'Access denied' });
      return;
    }
    req.schoolOwner = decoded;
    next();
  } catch {
    res.status(401).json({ message: 'Not authorized, token invalid' });
  }
};
