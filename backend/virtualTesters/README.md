# TerraRun

A fitness-tracking web app — Strava crossed with a territory-conquest game.
Users log runs/walks via GPS; calories burnt generate a colored polygon
"territory" on a shared world map that other users can invade by running
through it.

**Phase 0** (project skeleton, all 6 Mongoose data models) and **Phase 1**
(email + phone auth, JWT sessions, profile CRUD) are done. Activity
tracking, territory generation, and everything else still land in later
phases. See `terrarun_phased_build_prompts.md` (outside this repo, wherever
you're tracking it) for the full phase-by-phase plan.

## Stack

- **Frontend**: React (Vite) + Tailwind CSS + React Router
- **Backend**: Node.js + Express + Mongoose (MongoDB)
- **Auth (Phase 1)**: JWT access + refresh tokens, bcrypt, Firebase Phone
  Auth for OTP verification
- Later phases add: Turf.js (geometry), Socket.io, node-cron, Nodemailer, and
  a voice/video SDK.

## Phase 1 — Auth & Profiles

- **Email signup/login**: `POST /api/auth/signup/email`, `POST /api/auth/login/email`
- **Phone signup/login** (same endpoint handles both, since Firebase Phone
  Auth is passwordless): `POST /api/auth/phone` with `{ idToken, name? }`
- **Session refresh**: `POST /api/auth/refresh` — reads the httpOnly refresh
  cookie, returns a new short-lived access token
- **Logout**: `POST /api/auth/logout` — invalidates all outstanding refresh
  tokens for that user
- **Profile**: `GET /api/profile/me`, `PATCH /api/profile/me` (both require
  `Authorization: Bearer <accessToken>`)

Before phone auth will work, you need to do a one-time Firebase console
setup — the full walkthrough is a comment block at the top of
`backend/src/controllers/authController.js`. Email/password auth works with
zero Firebase setup.

New env vars for this phase are documented in `backend/.env.example` and
`frontend/.env.example` — copy them into your real `.env` / `.env.local`
files and fill in `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` at minimum
(the Firebase ones only matter once you set up phone auth).

## Project structure

```
TerraRun/
├── backend/
│   ├── src/
│   │   ├── config/       # MongoDB connection
│   │   ├── controllers/  # (empty — Phase 1+)
│   │   ├── jobs/         # (empty — cron jobs, Phase 5+)
│   │   ├── middleware/   # (empty — Phase 1+)
│   │   ├── models/       # User, Activity, Territory, Friendship, Message, Notification
│   │   ├── routes/       # health.js (more added each phase)
│   │   ├── utils/        # (empty)
│   │   ├── app.js        # Express app assembly (no side effects — testable)
│   │   └── server.js     # Entry point: connects DB, starts listening
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/   # NavBar, PlaceholderPage
│   │   ├── pages/        # Map, LoginSignup, Profile, Leaderboard, FriendsChat
│   │   ├── App.jsx        # Route table
│   │   ├── main.jsx       # Entry point
│   │   └── index.css      # Tailwind import + design tokens
│   ├── .env.example
│   └── package.json
└── package.json           # Root — runs both servers together
```

## Prerequisites

- Node.js 18+
- A MongoDB instance — either:
  - **Local**: install MongoDB Community Server and run `mongod` (its default
    URI, `mongodb://127.0.0.1:27017/terrarun`, already matches
    `backend/.env.example`), or
  - **Atlas free tier**: create a free cluster at mongodb.com/atlas, grab its
    connection string.

## Setup

```bash
# 1. Install dependencies for the root, backend, and frontend
npm run install:all

# 2. Create your real .env files from the examples
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local

# 3. Edit backend/.env and set MONGODB_URI to your local or Atlas connection string

# 4. Boot both servers together
npm run dev
```

- Backend: http://localhost:5000 — health check at http://localhost:5000/api/health
- Frontend: http://localhost:5173

You can also run them separately with `npm run dev:backend` /
`npm run dev:frontend` from the root, or `npm run dev` inside either
`backend/` or `frontend/` directly.

## Verifying Phase 0 is done

- [ ] `npm run dev` (from the root) boots both servers without a port conflict
- [ ] `curl http://localhost:5000/api/health` returns `200` with `"db":"connected"` (once `MONGODB_URI` points at a real, reachable database)
- [ ] All 6 schemas import cleanly — already confirmed by `server.js` itself, which imports `models/index.js` on boot; if any schema had an error, the server would fail to start
- [ ] Visiting http://localhost:5173 shows the TerraRun shell with working nav links to Map, Leaderboard, Friends & Chat, Profile, and Log in

## Verifying Phase 1 is done

- [ ] Set `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` in `backend/.env` (any random string works for dev — see the generator command in `.env.example`)
- [ ] Sign up a test user via the Email tab on `/login` — you land on the app logged in, and `NavBar` shows your name instead of "Log in"
- [ ] Edit your profile fields on `/profile` (weight, height, country/state, territory color) and confirm "Profile saved" appears
- [ ] Reload the page — you're still logged in (this is the refresh-cookie flow, not localStorage)
- [ ] Click "Log out" — you're logged out, and visiting `/profile` directly redirects to `/login`
- [ ] Do the Firebase console setup (comment block at the top of `backend/src/controllers/authController.js`), set the `VITE_FIREBASE_*` vars, then sign up a **second** test user via the Phone tab — you now have the two test accounts later phases assume exist
- [ ] Confirm in MongoDB directly (or via `GET /api/profile/me`) that no user document ever has a plaintext password — only `passwordHash`

## Notes for the next phase

- `backend/src/app.js` has commented-out mount points for each remaining
  phase's router (`/api/activities`, `/api/territories`, etc.) so you know
  where new routes plug in.
- Phase 2 (activity recording) will need `req.userId` from `requireAuth`
  (`backend/src/middleware/auth.js`) and the user's `bodyWeightKg` from the
  profile you just built — both are ready to use.
- `backend/src/utils/apiError.js` / `sanitizeUser.js` / `validators.js` are
  small, generic helpers — reuse them rather than re-inventing per-phase
  equivalents.
