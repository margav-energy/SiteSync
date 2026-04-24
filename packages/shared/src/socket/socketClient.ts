import { io, Socket } from 'socket.io-client';
import { config } from '../config/apiConfig';

let socket: Socket | null = null;

export function initSocket(token: string, userId: string): Socket {
  if (socket?.connected) {
    return socket;
  }

  socket = io(config.socketUrl, {
    auth: { token },
    // Web often blocks raw WS; polling keeps new-message + unread invalidation working.
    transports: ['websocket', 'polling'],
  });

  socket.on('connect', () => {
    socket?.emit('join-user-room', userId);
  });

  return socket;
}

export function getSocket(): Socket | null {
  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
