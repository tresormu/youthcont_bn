import jwt from 'jsonwebtoken';
import { Response } from 'express';
import config from '../config/config';

const generateToken = (res: Response, userId: string): void => {
  const expiresInDays = parseInt(config.jwtExpiresIn ?? '5') || 5;
  const token = jwt.sign({ userId }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  } as jwt.SignOptions);

  const isProd = config.nodeEnv !== 'development';
  res.cookie('jwt', token, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    maxAge: expiresInDays * 24 * 60 * 60 * 1000,
  });
};

export default generateToken;
