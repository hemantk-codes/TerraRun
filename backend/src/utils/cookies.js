export const REFRESH_COOKIE_NAME = 'terrarun_refresh';

// Parses simple jsonwebtoken-style expiry strings ("30d", "15m", "1h", "45s").
// Falls back to 30 days if the env var is missing/malformed.
function parseExpiryToMs(expiry) {
  const match = /^(\d+)([smhd])$/.exec(expiry || '');
  if (!match) return 30 * 24 * 60 * 60 * 1000;
  const value = Number(match[1]);
  const unitMs = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[match[2]];
  return value * unitMs;
}

function refreshMaxAgeMs() {
  return parseExpiryToMs(process.env.JWT_REFRESH_EXPIRES || '30d');
}

// Scoped to /api/auth (rather than the whole site) since that's the only
// path prefix that ever needs to read this cookie (/refresh, /logout).
const COOKIE_PATH = '/api/auth';

export function setRefreshCookie(res, token) {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: refreshMaxAgeMs(),
    path: COOKIE_PATH,
  });
}

export function clearRefreshCookie(res) {
  res.clearCookie(REFRESH_COOKIE_NAME, { path: COOKIE_PATH });
}
