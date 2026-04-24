import React, { useEffect } from 'react';
import { useAuthContext } from './AuthContext';
import { getStoredToken } from '../utils/storage';
import { initSocket, disconnectSocket } from '../socket/socketClient';

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuthContext();

  useEffect(() => {
    if (!isAuthenticated || !user?.id) {
      disconnectSocket();
      return;
    }

    let mounted = true;
    let detachChatListener: (() => void) | undefined;

    getStoredToken().then((token) => {
      if (!mounted || !token || !user?.id) return;
      const socket = initSocket(token, user.id);

      const onNewMessage = () => {};
      const onNewNotification = () => {};
      socket.on('new-message', onNewMessage);
      socket.on('new-notification', onNewNotification);
      detachChatListener = () => {
        socket.off('new-message', onNewMessage);
        socket.off('new-notification', onNewNotification);
      };
    });

    return () => {
      mounted = false;
      detachChatListener?.();
      disconnectSocket();
    };
  }, [isAuthenticated, user?.id]);

  return <>{children}</>;
}
