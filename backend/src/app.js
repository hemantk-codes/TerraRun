import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';

import healthRouter from './routes/health.js';
import authRouter from './routes/auth.js';
import profileRouter from './routes/profile.js';
import activitiesRouter from './routes/activities.js';
import territoriesRouter from './routes/territories.js'; // Phase 4
import leaderboardRouter from './routes/leaderboard.js'; // Phase 5
import streakStoppersRouter from './routes/streakStoppers.js'; // Phase 8
import friendsRouter from './routes/friends.js'; // Phase 9
import messagesRouter from './routes/messages.js'; // Phase 9

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
      credentials: true, // required so the browser sends/accepts the httpOnly refresh cookie
    })
  );
  app.use(express.json());
  app.use(cookieParser());
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

  app.use('/api/health', healthRouter);
  app.use('/api/auth', authRouter); // Phase 1
  app.use('/api/profile', profileRouter); // Phase 1
  app.use('/api/activities', activitiesRouter); // Phase 2
  app.use('/api/territories', territoriesRouter); // Phase 4 — GET /nearby only for now
  app.use('/api/leaderboard', leaderboardRouter); // Phase 5
  app.use('/api/streak-stoppers', streakStoppersRouter); // Phase 8 — POST /use
  app.use('/api/friends', friendsRouter); // Phase 9 — follow/unfollow/status/search
  app.use('/api/messages', messagesRouter); // Phase 9 — conversation list + history (sending is Socket.io, see sockets/)

  // Routers added in later phases mount here, e.g.:
  // app.use('/api/notifications', notificationsRouter); // Phase 10

  // 404 fallback
  app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  // Centralized error handler — later phases should throw/next(err) rather
  // than hand-rolling res.status(...) blocks everywhere.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error('[error]', err);
    res.status(err.status || 500).json({
      error: err.message || 'Internal server error',
    });
  });

  return app;
}

export default createApp;
