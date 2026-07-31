import jwt from 'jsonwebtoken';

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set — copy backend/.env.example to backend/.env and fill it in.`);
  }
  return value;
}

// Tunable: how long an access token stays valid. Kept short (default 15m)
// since it's sent on every request and can't be revoked before it expires.
export function signAccessToken(payload) {
  return jwt.sign(payload, requireEnv('JWT_ACCESS_SECRET'), {
    expiresIn: process.env.JWT_ACCESS_EXPIRES || '15m',
  });
}

export function verifyAccessToken(token) {
  return jwt.verify(token, requireEnv('JWT_ACCESS_SECRET'));
}

// Tunable: how long a refresh token stays valid (default 30d). Revocable
// early via User.refreshTokenVersion (see utils/cookies.js + authController).
export function signRefreshToken(payload) {
  return jwt.sign(payload, requireEnv('JWT_REFRESH_SECRET'), {
    expiresIn: process.env.JWT_REFRESH_EXPIRES || '30d',
  });
}

export function verifyRefreshToken(token) {
  return jwt.verify(token, requireEnv('JWT_REFRESH_SECRET'));
}
