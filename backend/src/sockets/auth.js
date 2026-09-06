import { verifyAccessToken } from '../utils/jwt.js';

/**
 * Socket.io connection middleware — mirrors middleware/auth.js's HTTP
 * requireAuth, but sockets authenticate once at handshake time instead of
 * per-request. The frontend passes the access token via
 * `socket.handshake.auth.token` (see frontend/src/lib/socket.js), NOT an
 * Authorization header — Socket.io's handshake auth payload is the
 * conventional place for this.
 *
 * Deliberately does NOT try to piggyback on the httpOnly refresh-token
 * cookie: cookies are same-origin/CORS-scoped for the REST API, and
 * threading them through the WebSocket upgrade adds complexity for no real
 * benefit here — the short-lived access token the client already holds in
 * memory (Phase 1) is enough. If it expires mid-session, the client's
 * existing access-token-refresh flow (Phase 1) should reconnect the socket
 * with a fresh token — see the reconnection note in frontend/src/lib/socket.js.
 */
export function socketAuth(socket, next) {
  const token = socket.handshake.auth?.token;
  if (!token) {
    return next(new Error('UNAUTHORIZED'));
  }
  try {
    const payload = verifyAccessToken(token);
    socket.userId = payload.sub;
    next();
  } catch {
    next(new Error('UNAUTHORIZED'));
  }
}
