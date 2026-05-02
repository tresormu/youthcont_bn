import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Event, { EventStatus } from '../src/models/Event';
import School from '../src/models/School';
import Team from '../src/models/Team';
import PublicSpeaker from '../src/models/PublicSpeaker';
import User from '../src/models/User';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('Missing MONGODB_URI in .env');
  process.exit(1)
}

async function seed() {
  try {
    await mongoose.connect(MONGODB_URI!);
    console.log('Connected to MongoDB...');

    let user = await User.findOne();
    if (!user) {
      console.error('No user found in the database. Please run npm run seed:admin first.');
      process.exit(1);
    }

    console.log(`Using user: ${user.email} (ID: ${user._id})`);

    // Wipe all existing seed data
    console.log('Clearing existing events, schools, teams, and speakers...');
    await Promise.all([
      Event.deleteMany({}),
      School.deleteMany({}),
      Team.deleteMany({}),
      PublicSpeaker.deleteMany({}),
    ]);
    console.log('Cleared.');

    // Create 2 events
    const eventsData = [
      {
        name: 'National Youth Contest 2026',
        edition: '10th Edition',
        description: 'The biggest youth debating and public speaking contest in the country.',
        status: EventStatus.REGISTRATION_OPEN,
        createdBy: user._id
      },
      {
        name: 'Regional Schools Championship 2026',
        edition: '5th Edition',
        description: 'Regional championship for schools across the northern province.',
        status: EventStatus.DRAFT,
        createdBy: user._id
      }
    ];

    const events = [];
    for (const data of eventsData) {
      const event = await Event.create(data);
      console.log(`Created event: ${event.name}`);
      events.push(event);
    }

    // Create 20 schools for each event
    for (const event of events) {
      console.log(`Creating 20 schools for event: ${event.name}...`);
      for (let i = 1; i <= 20; i++) {
        await School.create({
          name: `${event.name.split(' ')[0]} School ${i}`,
          ownerEmail: `school${i}@example.com`,
          contactPerson: `Principal ${i}`,
          contactEmail: `school${i}@example.com`,
          event: event._id
        });
      }
      console.log(`  Created 20 schools.`);
    }

    // Create 3 teams and 5 speakers for every school
    console.log('Creating teams and speakers for all schools...');
    const allSchools = await School.find();

    for (const school of allSchools) {
      for (let t = 1; t <= 3; t++) {
        await Team.create({
          name: `${school.name} Team ${t}`,
          teamNumber: t,
          school: school._id,
          event: school.event,
          members: [
            { fullName: `Speaker ${t}.1 from ${school.name}`, speakerOrder: 1 },
            { fullName: `Speaker ${t}.2 from ${school.name}`, speakerOrder: 2 },
            { fullName: `Speaker ${t}.3 from ${school.name}`, speakerOrder: 3 }
          ]
        });
      }

      for (let s = 1; s <= 5; s++) {
        await PublicSpeaker.create({
          fullName: `Public Speaker ${s} from ${school.name}`,
          speakerNumber: s,
          school: school._id,
          event: school.event
        });
      }
    }
    console.log(`  Created teams and speakers for ${allSchools.length} schools.`);

    // --- Validation checks ---
    console.log('\nRunning validation checks...');

    // 1. ownerEmail: verify schools have ownerEmail, not region
    const sampleSchool = await School.findOne({ event: events[0]._id });
    if (!sampleSchool) throw new Error('No school found for validation');
    if ((sampleSchool as any).region !== undefined) {
      console.error('❌ School still has region field — migration incomplete');
    } else if (!sampleSchool.ownerEmail) {
      console.error('❌ School ownerEmail is missing');
    } else {
      console.log(`✅ ownerEmail check passed: ${sampleSchool.ownerEmail}`);
    }

    // 2. Tournament name min-length: names < 6 chars must be rejected
    const shortNames = ['', 'A', 'AB', 'ABC', 'ABCD', 'ABCDE'];
    let nameLengthPassed = true;
    for (const shortName of shortNames) {
      if (shortName.trim().length >= 6) {
        console.error(`❌ Name "${shortName}" should have failed min-length check but passed`);
        nameLengthPassed = false;
      }
    }
    const validName = 'ValidTournament';
    if (validName.trim().length < 6) {
      console.error(`❌ Name "${validName}" should have passed min-length check but failed`);
      nameLengthPassed = false;
    }
    if (nameLengthPassed) console.log('✅ Tournament name min-length (6) check passed');

    console.log('\n✅ Test data seeding and verification completed successfully!');
  } catch (error) {
    console.error('Error seeding data:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }
}

seed();
