import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import {
  getActiveChatConversationId,
  getSocket,
  useAuthContext,
} from '@staff4dshire/shared';
import type { Message } from '@staff4dshire/shared';

let notificationHandlerConfigured = false;

function ensureNotificationHandler(): void {
  if (notificationHandlerConfigured || Platform.OS === 'web') return;
  notificationHandlerConfigured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/**
 * Shows a local notification when a chat message arrives for someone else,
 * unless that conversation is already open in the foreground.
 */
export function ChatNotificationListener() {
  const { user } = useAuthContext();

  useEffect(() => {
    ensureNotificationHandler();
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web' || !user?.id) return;

    (async () => {
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== 'granted') {
        await Notifications.requestPermissionsAsync();
      }
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('chat', {
          name: 'Chat',
          importance: Notifications.AndroidImportance.DEFAULT,
        });
      }
    })();
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || Platform.OS === 'web') return;

    let cancelled = false;
    let detach: (() => void) | undefined;

    const attach = (): boolean => {
      const socket = getSocket();
      if (!socket || cancelled) return false;
      const onMsg = (msg: Message) => {
        if (msg.sender_id === user.id) return;
        if (msg.conversation_id === getActiveChatConversationId()) return;

        void Notifications.scheduleNotificationAsync({
          content: {
            title: 'New message',
            body:
              msg.content.length > 120 ? `${msg.content.slice(0, 117)}…` : msg.content,
            data: { conversationId: msg.conversation_id },
            ...(Platform.OS === 'android' ? { channelId: 'chat' } : {}),
          },
          trigger: null,
        });
      };
      socket.on('new-message', onMsg);
      detach = () => socket.off('new-message', onMsg);
      return true;
    };

    if (attach()) {
      return () => {
        cancelled = true;
        detach?.();
      };
    }

    const id = setInterval(() => {
      if (attach()) clearInterval(id);
    }, 100);

    return () => {
      cancelled = true;
      clearInterval(id);
      detach?.();
    };
  }, [user?.id]);

  return null;
}
