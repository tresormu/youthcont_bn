import dotenv from 'dotenv';
dotenv.config();

const requireEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
};

const config = {
  port: Number(process.env.PORT) ,
  nodeEnv: process.env.NODE_ENV ,
  mongoUri: requireEnv('MONGODB_URI'),
  jwtSecret: requireEnv('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN,
  clientUrl: process.env.CLIENT_URL,
  seedAdmin: {
    name: requireEnv('SEED_ADMIN_NAME'),
    email: requireEnv('SEED_ADMIN_EMAIL'),
    password: requireEnv('SEED_ADMIN_PASSWORD'),
  },
  staff: {
    seedPassword: requireEnv('STAFF_SEED_PASSWORD'),
    dashboardUrl: process.env.STAFF_DASHBOARD_URL,
  },
  resend: {
    apiKey: requireEnv('RESEND_API_KEY'),
    fromEmail: process.env.RESEND_FROM_EMAIL || 'Youth Contest <noreply@youthcontest.com>',
  },
} as const;

export default config;
