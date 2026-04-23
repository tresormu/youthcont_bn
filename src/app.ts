import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import config from './config/config';
import authRoutes from './routes/authRoutes';
import adminRoutes from './routes/adminRoutes';
import eventRoutes from './routes/eventRoutes';
import schoolRoutes from './routes/schoolRoutes';
import matchRoutes from './routes/matchRoutes';
import staffRoutes from './routes/staffRoutes';
import staffAuthRoutes from './routes/staffAuthRoutes';
import contactRoutes from './routes/contactRoutes';

const app: Application = express();

app.use(helmet());
app.use(cors({
  origin: config.clientUrl,
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { message: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Routes
app.use('/api/v1/auth', authLimiter, authRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/staff/auth', authLimiter, staffAuthRoutes);
app.use('/api/v1/staff', staffRoutes);
app.use('/api/v1/events', eventRoutes);
app.use('/api/v1', schoolRoutes);
app.use('/api/v1', matchRoutes);
app.use('/api/v1/contact', contactRoutes);

app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', message: 'The Youth Contest API is running' });
});

// Global error handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(statusCode).json({
    message: err.message || 'Internal Server Error',
    ...(config.nodeEnv !== 'production' && { stack: err.stack }),
  });
});

export default app;
