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
  smtp: {
    host: requireEnv('EMAIL_HOST'),
    port: Number(process.env.EMAIL_PORT) || 587,
    user: requireEnv('EMAIL_USER'),
    pass: requireEnv('EMAIL_PASSWORD'),
    from: process.env.EMAIL_FROM || requireEnv('EMAIL_USER'),
  },
} as const;

export default config;
