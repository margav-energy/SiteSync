import { useEffect, useRef, useCallback } from 'react';
import { initSocket, getSocket, disconnectSocket } from '../socket/socketClient';

export function useSocket(token: string | null, userId: string | null) {
  const listenersRef = useRef<Map<string, (...args: unknown[]) => void>>(new Map());

  useEffect(() => {
    if (!token || !userId) {
      disconnectSocket();
      return;
    }

    const socket = initSocket(token, userId);

    const eventNames = [
      'new-message',
      'notification',
      'user-typing',
      'user-stopped-typing',
    ] as const;

    eventNames.forEach((event) => {
      const handler = (...args: unknown[]) => {
        const cb = listenersRef.current.get(event);
        if (cb) cb(...args);
      };
      socket.on(event, handler);
      return () => {
        socket.off(event);
      };
    });

    return () => {
      disconnectSocket();
    };
  }, [token, userId]);

  const on = useCallback((event: string, handler: (...args: unknown[]) => void) => {
    listenersRef.current.set(event, handler);
    return () => listenersRef.current.delete(event);
  }, []);

  const emit = useCallback((event: string, ...args: unknown[]) => {
    const socket = getSocket();
    if (socket?.connected) {
      socket.emit(event, ...args);
    }
  }, []);

  return {
    socket: getSocket(),
    on,
    emit,
  };
}
