import { Server } from 'socket.io';
import { socketAuth } from './auth.js';
import { registerChatHandlers } from './chatHandlers.js';

/**
 * Attaches Socket.io to the existing HTTP server. Called once from
 * server.js using the SAME underlying http.Server instance the Express app
 * is bound to, so REST and WebSocket traffic share one port — no separate
 * socket port to configure on the frontend or manage in deployment.
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

  return io;
}
