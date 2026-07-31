import { verifyAccessToken } from '../utils/jwt.js';
import { ApiError } from '../utils/apiError.js';

// Protects a route: requires `Authorization: Bearer <accessToken>`.
// On success, attaches req.userId for downstream controllers.
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return next(new ApiError(401, 'Missing or malformed Authorization header.'));
  }

  try {
    const payload = verifyAccessToken(token);
    req.userId = payload.sub;
    next();
  } catch {
    next(new ApiError(401, 'Access token expired or invalid.'));
  }
}
