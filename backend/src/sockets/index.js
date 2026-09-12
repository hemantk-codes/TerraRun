import { Server } from 'socket.io';
import { socketAuth } from './auth.js';
import { registerChatHandlers } from './chatHandlers.js';
import { setIO } from './ioInstance.js'; // Phase 10

/**
 * Attaches Socket.io to the existing HTTP server. Called once from
 * server.js using the SAME underlying http.Server instance the Express app
 * is bound to, so REST and WebSocket traffic share one port.
 */
export function initSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
      credentials: true,
    },
  });

  io.use(socketAuth);

  io.on('connection', (socket) => {
    registerChatHandlers(io, socket);
  });

  // PHASE 10 — lets utils/notificationService.js (and anything it's
  // imported into: invasionEngine, splitEngine, decayEngine, decayJobs,
  // calonsResetJobs, friendController) reach this exact `io` instance
  // without importing this file back into itself.
  setIO(io);

  return io;
}
