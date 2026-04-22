# Youth Contest — Backend API

REST API for managing youth debate/speech competitions. Built with Node.js, Express, TypeScript, and MongoDB.

---

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express 5
- **Language**: TypeScript
- **Database**: MongoDB via Mongoose
- **Auth**: JWT (httpOnly cookies)
- **Email**: Nodemailer
- **Export**: ExcelJS

---

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Fill in all values in `.env`. See the [Environment Variables](#environment-variables) section below.

### 3. Seed the admin account

Run once on a fresh deployment:

```bash
npm run seed:admin
```

### 4. Start the server

```bash
# Development (hot reload)
npm run dev

# Production
npm run build
npm start
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `PORT` | No | Server port (default: 5000) |
| `NODE_ENV` | No | `development` or `production` |
| `MONGODB_URI` | Yes | MongoDB connection string |
| `CLIENT_URL` | No | Frontend origin for CORS (default: http://localhost:3000) |
| `JWT_SECRET` | Yes | Long random string for signing JWTs |
| `JWT_EXPIRES_IN` | No | Token expiry (default: 30d) |
| `SEED_ADMIN_NAME` | Yes | Display name for the seed admin |
| `SEED_ADMIN_EMAIL` | Yes | Login email for the seed admin |
| `SEED_ADMIN_PASSWORD` | Yes | Password for the seed admin |
| `STAFF_SEED_PASSWORD` | Yes | Temporary password issued to all new staff invites |
| `STAFF_DASHBOARD_URL` | No | Staff login URL included in invite emails |
| `SMTP_HOST` | Yes | SMTP server hostname |
| `SMTP_PORT` | No | SMTP port (default: 587) |
| `SMTP_USER` | Yes | SMTP username |
| `SMTP_PASS` | Yes | SMTP password |
| `SMTP_FROM` | No | Sender address (defaults to SMTP_USER) |

---

## User Roles

| Role | Description |
|---|---|
| `seed_admin` | Created via seed script. Full access including staff management. |
| `staff` | Invited by admin. Can manage events, schools, teams, and match results. |

---

## Authentication

### Admin
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/v1/auth/login` | Login |
| POST | `/api/v1/auth/logout` | Logout |
| GET | `/api/v1/auth/me` | Get current user |

### Staff
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/v1/staff/auth/login` | Login (returns PIN prompt if first login) |
| POST | `/api/v1/staff/auth/verify-pin` | Verify one-time PIN on first login |
| PATCH | `/api/v1/staff/auth/change-password` | Change password |
| POST | `/api/v1/staff/auth/logout` | Logout |

**First-time staff login flow:**
1. Admin invites staff → staff receives email with PIN code
2. Staff calls `/login` → gets `requiresPinVerification: true`
3. Staff calls `/verify-pin` with email, password, and PIN → receives JWT
4. Staff calls `/change-password` to set their own password

---

## API Reference

### Staff Management *(Admin only)*

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/v1/admin/staff` | Invite a new staff member by email |
| GET | `/api/v1/staff` | List all staff |
| PATCH | `/api/v1/staff/:id` | Update staff name or email |
| DELETE | `/api/v1/staff/:id` | Deactivate a staff member |

---

### Events (Competitions)

| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | `/api/v1/events` | Staff | Create an event |
| GET | `/api/v1/events` | Public | List all events |
| GET | `/api/v1/events/:id` | Public | Get event by ID |
| PATCH | `/api/v1/events/:id` | Staff | Update name, edition, description, date |
| DELETE | `/api/v1/events/:id` | Staff | Delete event and all associated data |
| PATCH | `/api/v1/events/:id/status` | Staff | Advance to next status |
| PATCH | `/api/v1/events/:id/status/rollback` | Staff | Roll back to previous status |

**Event lifecycle:**
```
Draft → Registration Open → Preliminary Rounds → Bracket Stage → Completed
```
Rollback is only allowed from `Registration Open` and `Preliminary Rounds`.

**Create/Update body:**
```json
{
  "name": "Youth Contest 2025",
  "edition": "5th Edition",
  "description": "Annual inter-school debate competition",
  "date": "2025-09-15"
}
```

---

### Schools

| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | `/api/v1/events/:eventId/schools` | Staff | Register a school |
| GET | `/api/v1/events/:eventId/schools` | Public | List schools for an event |
| PATCH | `/api/v1/events/:eventId/schools/:schoolId` | Staff | Update school details |
| DELETE | `/api/v1/events/:eventId/schools/:schoolId` | Staff | Remove a school |

Schools can be added during `Draft` or `Registration Open` status. Multiple staff members can register schools concurrently.

---

### Teams

| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | `/api/v1/schools/:schoolId/teams` | Staff | Register a team |
| GET | `/api/v1/schools/:schoolId/teams` | Public | List teams for a school |
| PATCH | `/api/v1/schools/:schoolId/teams/:teamId` | Staff | Update team |
| DELETE | `/api/v1/schools/:schoolId/teams/:teamId` | Staff | Delete team |

- Max **3 teams** per school
- Each team must have exactly **3 members** with `fullName`
- `speakerOrder` (1, 2, 3) is auto-assigned by position

**Register team body:**
```json
{
  "name": "Team Alpha",
  "members": [
    { "fullName": "Alice M." },
    { "fullName": "Bob K." },
    { "fullName": "Carol T." }
  ]
}
```

---

### Public Speakers

| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | `/api/v1/schools/:schoolId/public-speakers` | Staff | Register a public speaker |
| GET | `/api/v1/schools/:schoolId/public-speakers` | Public | List speakers for a school |
| DELETE | `/api/v1/schools/:schoolId/public-speakers/:speakerId` | Staff | Remove a speaker |

- Max **5 public speakers** per school
- `speakerNumber` (1–5) is auto-assigned

---

### Matchups & Matches

#### Preliminary Round

| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | `/api/v1/events/:eventId/matchups/auto` | Staff | Auto-assign school matchups randomly |
| POST | `/api/v1/events/:eventId/matchups` | Staff | Manually create a school matchup |
| GET | `/api/v1/events/:eventId/matchups` | Public | List all matchups for an event |
| DELETE | `/api/v1/events/:eventId/matchups/preliminary` | Staff | Cancel all preliminary matchups (reset) |
| DELETE | `/api/v1/matchups/:matchupId` | Staff | Cancel a single matchup |
| POST | `/api/v1/matchups/:matchupId/matches` | Staff | Add a team-vs-team match to a matchup |
| GET | `/api/v1/matchups/:matchupId/matches` | Public | List matches in a matchup |

#### Match Results

| Method | Endpoint | Access | Description |
|---|---|---|---|
| PATCH | `/api/v1/matches/:id/result` | Staff | Enter or correct a match result |
| PATCH | `/api/v1/matches/:id/void` | Staff | Void a result (revert to Pending) |

Entering a result awards the winner **+3 points** and increments `matchesPlayed` for both teams. Correcting or voiding a result fully reverses the previous stats before applying the new ones.

**Enter result body:**
```json
{ "winnerId": "<teamId>" }
```

---

### Bracket (Power 8)

| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | `/api/v1/events/:eventId/bracket/generate` | Staff | Generate Power 8 bracket |
| GET | `/api/v1/events/:eventId/bracket` | Public | Get bracket data (QF, SF, Final) |
| DELETE | `/api/v1/events/:eventId/bracket` | Staff | Cancel bracket and revert to Preliminary Rounds |

**Generate bracket body:**
```json
{
  "teamIds": ["<id1>", "<id2>", "<id3>", "<id4>", "<id5>", "<id6>", "<id7>", "<id8>"]
}
```
`teamIds` is optional. If omitted, the top 8 teams by points are selected automatically. If provided, staff must supply exactly 8 valid team IDs — their order determines seeding (position 1 vs 8, 2 vs 7, etc.).

**Bracket seeding:** `1v8, 2v7, 3v6, 4v5`

QF → SF → Final advancement is **automatic** once all matches in a stage are completed.

---

### Rankings & Export

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/api/v1/events/:eventId/rankings` | Public | Live rankings (all teams, sorted by points) |
| GET | `/api/v1/events/:eventId/rankings/excel` | Staff | Download full rankings as Excel file |

Rankings are sorted by `totalPoints` descending, then `matchesPlayed` ascending as tiebreaker (fewer games for same points = stronger).

Each entry includes: rank, team name, school, total points, matches played, matches won, furthest stage reached (Champion for the Final winner).

---

### Contact

| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | `/api/v1/contact` | Public | Submit a contact message |
| GET | `/api/v1/contact` | Admin | List all contact messages |
| PATCH | `/api/v1/contact/:id/status` | Admin | Update message status |

Valid reasons: `General Inquiry`, `Registration Help`, `Technical Issue`, `Partnership`, `Other`

Valid statuses: `New`, `Read`, `Resolved`

---

### Health Check

```
GET /health
```

---

## Complete Tournament Workflow

```
1. Admin creates event (POST /events) with name and date
2. Staff register schools (POST /events/:id/schools)
3. Staff register teams per school (POST /schools/:id/teams)
4. Admin advances event to Preliminary Rounds (PATCH /events/:id/status)
5. Staff auto-assign matchups (POST /events/:id/matchups/auto)
   — or manually create them (POST /events/:id/matchups)
6. Staff enter match results (PATCH /matches/:id/result)
   — results can be corrected or voided at any time
7. Staff view rankings (GET /events/:id/rankings) and select Power 8
8. Staff generate bracket with chosen teams (POST /events/:id/bracket/generate)
9. Staff enter QF results → SF auto-created → SF results → Final auto-created
10. Staff enter Final result → event marked Completed automatically
11. Staff export Excel rankings (GET /events/:id/rankings/excel)
```
