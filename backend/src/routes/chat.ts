import { Router } from 'express';
import type { UserRole } from '@prisma/client';
import { prisma } from '../db';
import type { AuthedRequest } from '../middleware/auth';
import { authMiddleware } from '../middleware/auth';
import * as S from '../lib/serialize';
import { canViewProject } from '../lib/projectAccess';
import type { Server as IoServer } from 'socket.io';

const router = Router();
router.use(authMiddleware);
router.use(async (req: AuthedRequest, _res, next) => {
  // Keep presence ("last seen") fresh while user is active in chat.
  if (req.userId) {
    try {
      await prisma.user.update({
        where: { id: req.userId },
        data: { lastLoginAt: new Date() },
      });
    } catch {
      // Ignore presence touch errors for chat responses.
    }
  }
  next();
});

function getIo(req: AuthedRequest): IoServer | undefined {
  return req.app.get('io');
}

function superadminChatAllowed(requesterRole: UserRole, otherRoles: UserRole[]): boolean {
  if (requesterRole === 'superadmin') {
    return otherRoles.every((r) => r === 'admin');
  }
  if (otherRoles.includes('superadmin')) {
    return requesterRole === 'admin';
  }
  return true;
}

/** Messages from others where the current user is not in read_by (tab badge). */
router.get('/unread-count', async (req: AuthedRequest, res) => {
  const uid = req.userId!;
  const role = req.userRole as UserRole;
  const candidateConversations = await prisma.conversation.findMany({
    where: {
      companyId: req.companyId!,
      type: 'direct',
      participants: { some: { userId: uid } },
      NOT: { archivedBy: { has: uid } },
    },
    select: {
      id: true,
      participants: { include: { user: { select: { role: true } } } },
    },
  });
  const allowedConversationIds = candidateConversations
    .filter((c) => {
      const otherRoles = c.participants
        .filter((p) => p.userId !== uid)
        .map((p) => p.user.role as UserRole);
      return superadminChatAllowed(role, otherRoles);
    })
    .map((c) => c.id);
  if (allowedConversationIds.length === 0) return res.json({ count: 0 });
  const count = await prisma.message.count({
    where: {
      conversationId: { in: allowedConversationIds },
      senderId: { not: uid },
      NOT: { readBy: { has: uid } },
    },
  });
  res.json({ count });
});

router.get('/conversations', async (req: AuthedRequest, res) => {
  const uid = req.userId!;
  const role = req.userRole as UserRole;
  const list = await prisma.conversation.findMany({
    where: {
      companyId: req.companyId!,
      type: 'direct',
      participants: { some: { userId: uid } },
      NOT: { archivedBy: { has: uid } },
    },
    include: {
      participants: { include: { user: { select: { role: true } } } },
      messages: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
    orderBy: { updatedAt: 'desc' },
  });
  const allowedList = list.filter((c) => {
    const otherRoles = c.participants
      .filter((p) => p.userId !== uid)
      .map((p) => p.user.role as UserRole);
    return superadminChatAllowed(role, otherRoles);
  });

  const convIds = allowedList.map((c) => c.id);
  const unreadByConv = new Map<string, number>();
  if (convIds.length) {
    // Per-conversation counts (same filter as GET /unread-count) — avoids groupBy _count edge cases.
    await Promise.all(
      convIds.map(async (cid) => {
        const n = await prisma.message.count({
          where: {
            conversationId: cid,
            senderId: { not: uid },
            NOT: { readBy: { has: uid } },
          },
        });
        unreadByConv.set(cid, n);
      })
    );
  }

  res.json(
    allowedList.map((c) => {
      const base = S.conversation({
        ...c,
        participants: c.participants,
        messages: c.messages,
      });
      return { ...base, unread_count: unreadByConv.get(c.id) ?? 0 };
    })
  );
});

router.get('/search', async (req: AuthedRequest, res) => {
  const uid = req.userId!;
  const role = req.userRole as UserRole;
  const query = String(req.query.query ?? '').trim();
  if (!query) return res.json({ conversation_ids: [] as string[] });

  const conversations = await prisma.conversation.findMany({
    where: {
      companyId: req.companyId!,
      type: 'direct',
      participants: { some: { userId: uid } },
      NOT: { archivedBy: { has: uid } },
    },
    select: {
      id: true,
      participants: { select: { userId: true, user: { select: { role: true } } } },
    },
  });
  const allowedConversations = conversations.filter((c) => {
    const otherRoles = c.participants
      .filter((p) => p.userId !== uid)
      .map((p) => p.user.role as UserRole);
    return superadminChatAllowed(role, otherRoles);
  });
  if (allowedConversations.length === 0) return res.json({ conversation_ids: [] as string[] });

  const convIds = allowedConversations.map((c) => c.id);
  const participantIds = Array.from(
    new Set(allowedConversations.flatMap((c) => c.participants.map((p) => p.userId)))
  );

  const users = await prisma.user.findMany({
    where: {
      id: { in: participantIds },
      ...(req.userRole === 'superadmin' ? {} : { companyId: req.companyId! }),
    },
    select: { id: true, firstName: true, lastName: true, email: true },
  });
  const q = query.toLowerCase();
  const matchedUserIds = new Set(
    users
      .filter((u) => `${u.firstName ?? ''} ${u.lastName ?? ''} ${u.email}`.toLowerCase().includes(q))
      .map((u) => u.id)
  );

  const matchedByPeople = allowedConversations
    .filter((c) => c.participants.some((p) => matchedUserIds.has(p.userId)))
    .map((c) => c.id);

  const matchedMessages = await prisma.message.findMany({
    where: {
      conversationId: { in: convIds },
      content: { contains: query, mode: 'insensitive' },
    },
    select: { conversationId: true },
    distinct: ['conversationId'],
  });
  const matchedByMessages = matchedMessages.map((m) => m.conversationId);

  const conversation_ids = Array.from(new Set([...matchedByPeople, ...matchedByMessages]));
  res.json({ conversation_ids });
});

router.post('/conversations', async (req: AuthedRequest, res) => {
  const body = req.body ?? {};
  const participants: string[] = body.participants ?? [];
  const projectId = body.project_id ?? body.projectId;
  if (!participants.length) {
    return res.status(400).json({ error: 'participants required' });
  }
  const ids = [...new Set([...participants, req.userId!])];
  const users = await prisma.user.findMany({ where: { id: { in: ids } } });
  if (users.length !== ids.length) {
    return res.status(400).json({ error: 'Invalid participant' });
  }
  const requesterRole = req.userRole as UserRole;
  const otherRoles = users
    .filter((u) => u.id !== req.userId)
    .map((u) => u.role as UserRole);
  if (!superadminChatAllowed(requesterRole, otherRoles)) {
    return res.status(403).json({ error: 'Superadmin can only chat with admins' });
  }
  const companyIds = new Set(users.map((u) => u.companyId));
  if (companyIds.size !== 1) {
    return res.status(400).json({ error: 'Participants must belong to the same company' });
  }
  const participantCompanyId = users[0].companyId;
  if (req.userRole !== 'superadmin' && participantCompanyId !== req.companyId) {
    return res.status(400).json({ error: 'Participants must belong to your company' });
  }

  let companyId = req.userRole === 'superadmin' ? participantCompanyId : req.companyId!;
  if (projectId) {
    const p = await prisma.project.findUnique({ where: { id: projectId } });
    if (!p || p.companyId !== companyId) {
      return res.status(400).json({ error: 'Invalid project' });
    }
    if (!canViewProject(req, p)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
  }

  // Reuse any existing direct conversation with same participants to avoid duplicate threads.
  const existing = await prisma.conversation.findMany({
    where: {
      companyId,
      type: 'direct',
      participants: { some: { userId: req.userId! } },
    },
    include: {
      participants: { select: { userId: true } },
      messages: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
    take: 100,
  });
  const wanted = new Set(ids);
  const match = existing.find((c) => {
    if (c.participants.length !== wanted.size) return false;
    for (const p of c.participants) {
      if (!wanted.has(p.userId)) return false;
    }
    return true;
  });
  if (match) {
    // If this conversation was archived for creator, restore it.
    if ((match.archivedBy ?? []).includes(req.userId!)) {
      const archivedBy = (match.archivedBy ?? []).filter((id) => id !== req.userId!);
      const updated = await prisma.conversation.update({
        where: { id: match.id },
        data: { archivedBy },
        include: { participants: true, messages: { orderBy: { createdAt: 'desc' }, take: 1 } },
      });
      return res.json(S.conversation(updated));
    }
    return res.json(S.conversation(match));
  }

  const conv = await prisma.conversation.create({
    data: {
      companyId,
      projectId: projectId ?? null,
      type: 'direct',
      participants: {
        create: ids.map((userId) => ({ userId })),
      },
    },
    include: { participants: true, messages: true },
  });

  res.status(201).json(S.conversation({ ...conv, participants: conv.participants, messages: [] }));
});

router.put('/conversations/:id/archive', async (req: AuthedRequest, res) => {
  const uid = req.userId!;
  const archive = Boolean(req.body?.archive ?? true);
  const conv = await prisma.conversation.findFirst({
    where: {
      id: req.params.id,
      companyId: req.companyId!,
      participants: { some: { userId: uid } },
    },
  });
  if (!conv) return res.status(404).json({ error: 'Conversation not found' });
  const archivedBy = archive
    ? Array.from(new Set([...(conv.archivedBy ?? []), uid]))
    : (conv.archivedBy ?? []).filter((id) => id !== uid);
  const updated = await prisma.conversation.update({
    where: { id: conv.id },
    data: { archivedBy },
    include: { participants: true, messages: { orderBy: { createdAt: 'desc' }, take: 1 } },
  });
  res.json(S.conversation(updated));
});

router.delete('/conversations/:id', async (req: AuthedRequest, res) => {
  const uid = req.userId!;
  const conv = await prisma.conversation.findFirst({
    where: {
      id: req.params.id,
      companyId: req.companyId!,
      participants: { some: { userId: uid } },
    },
  });
  if (!conv) return res.status(404).json({ error: 'Conversation not found' });
  await prisma.conversation.delete({ where: { id: conv.id } });
  res.status(204).send();
});

async function ensureToolboxConversation(companyId: string) {
  const existing = await prisma.conversation.findFirst({
    where: { companyId, type: 'toolbox' },
    include: { participants: true },
  });
  if (existing) return existing;

  const users = await prisma.user.findMany({
    where: { companyId, isActive: true },
    select: { id: true },
  });
  return prisma.conversation.create({
    data: {
      companyId,
      type: 'toolbox',
      participants: { create: users.map((u) => ({ userId: u.id })) },
    },
    include: { participants: true },
  });
}

router.get('/toolbox', async (req: AuthedRequest, res) => {
  const uid = req.userId!;
  const conv = await ensureToolboxConversation(req.companyId!);
  const archived = (conv.archivedBy ?? []).includes(uid);
  const messages = await prisma.message.findMany({
    where: { conversationId: conv.id },
    orderBy: { createdAt: 'asc' },
    take: 500,
  });
  res.json({
    conversation_id: conv.id,
    archived,
    messages: messages.map(S.message),
  });
});

router.post('/toolbox/messages', async (req: AuthedRequest, res) => {
  const body = req.body ?? {};
  const contentRaw = body.content != null ? String(body.content) : '';
  const attachmentUrl = body.attachment_url ?? body.attachmentUrl ?? undefined;
  if (!contentRaw.trim() && !attachmentUrl) {
    return res.status(400).json({ error: 'content or attachment required' });
  }
  const conv = await ensureToolboxConversation(req.companyId!);
  const msg = await prisma.message.create({
    data: {
      conversationId: conv.id,
      senderId: req.userId!,
      content: contentRaw.trim(),
      attachmentUrl: attachmentUrl ?? undefined,
    },
  });
  await prisma.conversation.update({
    where: { id: conv.id },
    data: {
      updatedAt: new Date(),
      archivedBy: { set: (conv.archivedBy ?? []).filter((id) => id !== req.userId!) },
    },
  });
  res.status(201).json(S.message(msg));
});

router.put('/toolbox/archive', async (req: AuthedRequest, res) => {
  const uid = req.userId!;
  const archive = Boolean(req.body?.archive ?? true);
  const conv = await ensureToolboxConversation(req.companyId!);
  const archivedBy = archive
    ? Array.from(new Set([...(conv.archivedBy ?? []), uid]))
    : (conv.archivedBy ?? []).filter((id) => id !== uid);
  await prisma.conversation.update({ where: { id: conv.id }, data: { archivedBy } });
  res.status(204).send();
});

router.get('/conversations/:id/messages', async (req: AuthedRequest, res) => {
  const conv = await prisma.conversation.findFirst({
    where: {
      id: req.params.id,
      companyId: req.companyId!,
      participants: { some: { userId: req.userId! } },
    },
  });
  if (!conv) return res.status(404).json({ error: 'Not found' });

  const messages = await prisma.message.findMany({
    where: { conversationId: req.params.id },
    orderBy: { createdAt: 'asc' },
    take: 500,
  });
  res.json(messages.map(S.message));
});

router.post('/messages', async (req: AuthedRequest, res) => {
  const body = req.body ?? {};
  const conversationId = body.conversation_id ?? body.conversationId;
  const contentRaw = body.content != null ? String(body.content) : '';
  const attachmentUrl = body.attachment_url ?? body.attachmentUrl ?? undefined;
  if (!conversationId || (!contentRaw.trim() && !attachmentUrl)) {
    return res.status(400).json({ error: 'conversation_id and text or attachment required' });
  }

  const conv = await prisma.conversation.findFirst({
    where: {
      id: conversationId,
      companyId: req.companyId!,
      participants: { some: { userId: req.userId! } },
    },
    include: { participants: true },
  });
  if (!conv) return res.status(404).json({ error: 'Conversation not found' });
  const requesterRole = req.userRole as UserRole;
  const participantUsers = await prisma.user.findMany({
    where: { id: { in: conv.participants.map((p) => p.userId) } },
    select: { id: true, role: true },
  });
  const otherRoles = participantUsers
    .filter((u) => u.id !== req.userId)
    .map((u) => u.role as UserRole);
  if (!superadminChatAllowed(requesterRole, otherRoles)) {
    return res.status(403).json({ error: 'Superadmin can only chat with admins' });
  }

  const msg = await prisma.message.create({
    data: {
      conversationId,
      senderId: req.userId!,
      content: contentRaw.trim(),
      attachmentUrl: attachmentUrl ?? undefined,
    },
  });

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  });

  const io = getIo(req);
  const serialized = S.message(msg);
  // Deliver to each participant's user room so they receive messages even when not in the conversation room.
  // Skip sender — they already have the HTTP response + client mutation.
  for (const p of conv.participants) {
    if (p.userId !== req.userId!) {
      io?.to(`user:${p.userId}`).emit('new-message', serialized);
    }
  }

  res.status(201).json(serialized);
});

router.put('/messages/:id', async (req: AuthedRequest, res) => {
  const contentRaw = req.body?.content != null ? String(req.body.content) : '';
  const content = contentRaw.trim();
  if (!content) return res.status(400).json({ error: 'content required' });

  const existing = await prisma.message.findUnique({
    where: { id: req.params.id },
    include: {
      conversation: {
        include: { participants: { where: { userId: req.userId! } } },
      },
    },
  });
  if (!existing) return res.status(404).json({ error: 'Not found' });
  if (existing.conversation.companyId !== req.companyId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (existing.conversation.participants.length === 0 || existing.senderId !== req.userId) {
    return res.status(403).json({ error: 'Only sender can edit this message' });
  }

  const updated = await prisma.message.update({
    where: { id: existing.id },
    data: { content },
  });
  await prisma.conversation.update({
    where: { id: updated.conversationId },
    data: { updatedAt: new Date() },
  });
  res.json(S.message(updated));
});

router.delete('/messages/:id', async (req: AuthedRequest, res) => {
  const existing = await prisma.message.findUnique({
    where: { id: req.params.id },
    include: {
      conversation: {
        include: { participants: { where: { userId: req.userId! } } },
      },
    },
  });
  if (!existing) return res.status(404).json({ error: 'Not found' });
  if (existing.conversation.companyId !== req.companyId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (existing.conversation.participants.length === 0 || existing.senderId !== req.userId) {
    return res.status(403).json({ error: 'Only sender can delete this message' });
  }

  await prisma.message.delete({ where: { id: existing.id } });
  await prisma.conversation.update({
    where: { id: existing.conversationId },
    data: { updatedAt: new Date() },
  });
  res.status(204).send();
});

router.put('/messages/:id/read', async (req: AuthedRequest, res) => {
  const m = await prisma.message.findUnique({
    where: { id: req.params.id },
    include: {
      conversation: {
        include: { participants: { where: { userId: req.userId! } } },
      },
    },
  });
  if (!m) return res.status(404).json({ error: 'Not found' });
  if (m.conversation.companyId !== req.companyId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (m.conversation.participants.length === 0) {
    return res.status(403).json({ error: 'Not a participant' });
  }
  const readBy = m.readBy.includes(req.userId!) ? m.readBy : [...m.readBy, req.userId!];
  await prisma.message.update({
    where: { id: req.params.id },
    data: { readBy },
  });
  res.status(204).send();
});

export default router;
