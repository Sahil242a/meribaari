import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';

let io = null;

/**
 * Rooms:
 *   clinic:<id>  public queue state (token numbers only, no names/phones)
 *   staff:<id>   full state for logged-in staff of that clinic
 *   token:<id>   personal alerts for one patient
 */
export function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: config.clientOrigin, credentials: true },
  });

  io.on('connection', (socket) => {
    socket.on('join:clinic', (clinicId) => {
      if (typeof clinicId === 'string' && clinicId.length < 40) socket.join(`clinic:${clinicId}`);
    });

    socket.on('join:token', (tokenId) => {
      if (typeof tokenId === 'string' && tokenId.length < 40) socket.join(`token:${tokenId}`);
    });

    socket.on('join:staff', () => {
      const staff = staffFromCookie(socket.handshake.headers.cookie);
      if (staff) socket.join(`staff:${staff.clinic}`);
      else socket.emit('auth:error', 'Login required');
    });
  });

  return io;
}

function staffFromCookie(cookieHeader = '') {
  const match = cookieHeader.match(/(?:^|;\s*)mb_session=([^;]+)/);
  if (!match) return null;
  try {
    return jwt.verify(decodeURIComponent(match[1]), config.jwtSecret);
  } catch {
    return null;
  }
}

export function emitToClinic(clinicId, event, payload) {
  io?.to(`clinic:${clinicId}`).emit(event, payload);
}

export function emitToStaff(clinicId, event, payload) {
  io?.to(`staff:${clinicId}`).emit(event, payload);
}

export function emitToToken(tokenId, event, payload) {
  io?.to(`token:${tokenId}`).emit(event, payload);
}
