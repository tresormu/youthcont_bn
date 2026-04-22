/**
 * One-time seed admin bootstrap script.
 * Run once on a fresh deployment: npm run seed:admin
 * The seed admin account cannot be created or removed from the UI.
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;
const SEED_ADMIN_NAME = process.env.SEED_ADMIN_NAME;
const SEED_ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL;
const SEED_ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD;

if (!MONGODB_URI || !SEED_ADMIN_NAME || !SEED_ADMIN_EMAIL || !SEED_ADMIN_PASSWORD) {
  console.error('Missing required env vars: MONGODB_URI, SEED_ADMIN_NAME, SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD');
  process.exit(1);
}

async function seed() {
  await mongoose.connect(MONGODB_URI!);

  // Dynamically import model after connection
  const User = (await import('../src/models/User')).default;

  const existing = await User.findOne({ email: SEED_ADMIN_EMAIL });
  if (existing) {
    console.log(`Seed admin already exists: ${existing.email} (role: ${existing.role})`);
    await mongoose.disconnect();
    return;
  }

  const passwordHash = await bcrypt.hash(SEED_ADMIN_PASSWORD!, 12);

  const admin = await User.create({
    name: SEED_ADMIN_NAME,
    email: SEED_ADMIN_EMAIL,
    passwordHash,
    role: 'seed_admin',
    isActive: true,
  });

  console.log(`✅ Seed admin created: ${admin.email}`);
  console.log(`   Name     : ${admin.name}`);
  console.log(`   Login at : POST /api/v1/auth/login`);
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
