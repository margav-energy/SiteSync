import type { Prisma, PrismaClient } from '@prisma/client';
import type { Server as IoServer } from 'socket.io';
import { sendExpoPushToToken } from './sendExpoPush';

/**
 * Persist a notification, emit to socket, and send Expo push (if user has registered a token).
 */
export async function createNotification(
  prisma: PrismaClient,
  io: IoServer | undefined,
  params: {
    userId: string;
    title: string;
    body: string;
    type?: string;
    actionRoute?: string;
    actionParams?: Prisma.InputJsonValue;
  }
) {
  const n = await prisma.notification.create({
    data: {
      userId: params.userId,
      title: params.title,
      body: params.body,
      type: params.type ?? 'info',
      actionRoute: params.actionRoute,
      actionParams: params.actionParams,
    },
  });
  const payload = {
    id: n.id,
    title: n.title,
    body: n.body,
    type: n.type,
    action_route: n.actionRoute ?? undefined,
    action_params: n.actionParams ?? undefined,
    read: n.read,
    created_at: n.createdAt.toISOString(),
  };
  io?.to(`user:${params.userId}`).emit('new-notification', payload);

  const u = await prisma.user.findUnique({
    where: { id: params.userId },
    select: { expoPushToken: true },
  });
  await sendExpoPushToToken(u?.expoPushToken, {
    title: params.title,
    body: params.body,
    data: {
      notification_id: n.id,
      type: params.type ?? 'info',
      action_route: params.actionRoute,
      action_params: params.actionParams,
    },
  });

  return n;
}
