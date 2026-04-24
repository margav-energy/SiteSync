import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import type { Server as IoServer } from 'socket.io';
import { prisma } from '../db';
import type { AuthedRequest } from '../middleware/auth';
import { authMiddleware, effectiveRole } from '../middleware/auth';
import * as S from '../lib/serialize';
import { createNotification } from '../lib/createNotification';

const router = Router();
router.use(authMiddleware);

async function assertUserOnboardingAccess(req: AuthedRequest, targetUserId: string) {
  const target = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!target) return null;
  if (req.userRole === 'superadmin') return target;
  if (target.companyId !== req.companyId) return false;
  if (['admin', 'superadmin'].includes(effectiveRole(req))) return target;
  if (req.userId === targetUserId) return target;
  return false;
}

async function getOrCreateRecord(userId: string) {
  return prisma.onboardingRecord.upsert({
    where: { userId },
    create: { userId, status: 'pending' },
    update: {},
  });
}

function jsonPayload(body: Record<string, unknown>): Prisma.InputJsonValue {
  const { user_id: _u, userId: _u2, data, ...rest } = body;
  const raw = data ?? rest;
  return (raw && typeof raw === 'object' ? raw : {}) as Prisma.InputJsonValue;
}

/** GET /api/onboarding/progress/:userId */
router.get('/progress/:userId', async (req: AuthedRequest, res) => {
  const access = await assertUserOnboardingAccess(req, req.params.userId);
  if (access === null) return res.status(404).json({ error: 'Not found' });
  if (access === false) return res.status(403).json({ error: 'Forbidden' });
  const rec = await getOrCreateRecord(req.params.userId);
  res.json(S.onboardingRecord(rec));
});

/** GET /api/onboarding/new-starter/:userId */
router.get('/new-starter/:userId', async (req: AuthedRequest, res) => {
  const access = await assertUserOnboardingAccess(req, req.params.userId);
  if (access === null) return res.status(404).json({ error: 'Not found' });
  if (access === false) return res.status(403).json({ error: 'Forbidden' });
  const rec = await getOrCreateRecord(req.params.userId);
  res.json({ user_id: rec.userId, data: rec.newStarter ?? {} });
});

/** POST /api/onboarding/new-starter */
router.post('/new-starter', async (req: AuthedRequest, res) => {
  const body = req.body ?? {};
  const userId = String(body.user_id ?? body.userId ?? req.userId);
  const access = await assertUserOnboardingAccess(req, userId);
  if (access === null) return res.status(404).json({ error: 'Not found' });
  if (access === false) return res.status(403).json({ error: 'Forbidden' });
  const payload = jsonPayload(body as Record<string, unknown>);
  const rec = await prisma.onboardingRecord.upsert({
    where: { userId },
    create: { userId, status: 'pending', newStarter: payload },
    update: { newStarter: payload },
  });
  res.json(S.onboardingRecord(rec));
});

/** POST /api/onboarding/qualifications */
router.post('/qualifications', async (req: AuthedRequest, res) => {
  const body = req.body ?? {};
  const userId = String(body.user_id ?? body.userId ?? req.userId);
  const access = await assertUserOnboardingAccess(req, userId);
  if (access === null) return res.status(404).json({ error: 'Not found' });
  if (access === false) return res.status(403).json({ error: 'Forbidden' });
  const payload = jsonPayload(body as Record<string, unknown>);
  const rec = await prisma.onboardingRecord.upsert({
    where: { userId },
    create: { userId, status: 'pending', qualifications: payload },
    update: { qualifications: payload },
  });
  res.json(S.onboardingRecord(rec));
});

/** POST /api/onboarding/policies */
router.post('/policies', async (req: AuthedRequest, res) => {
  const body = req.body ?? {};
  const userId = String(body.user_id ?? body.userId ?? req.userId);
  const access = await assertUserOnboardingAccess(req, userId);
  if (access === null) return res.status(404).json({ error: 'Not found' });
  if (access === false) return res.status(403).json({ error: 'Forbidden' });
  const payload = jsonPayload(body as Record<string, unknown>);
  const rec = await prisma.onboardingRecord.upsert({
    where: { userId },
    create: { userId, status: 'pending', policies: payload },
    update: { policies: payload },
  });
  res.json(S.onboardingRecord(rec));
});

/** GET /api/onboarding/cis/:userId */
router.get('/cis/:userId', async (req: AuthedRequest, res) => {
  const access = await assertUserOnboardingAccess(req, req.params.userId);
  if (access === null) return res.status(404).json({ error: 'Not found' });
  if (access === false) return res.status(403).json({ error: 'Forbidden' });
  const rec = await getOrCreateRecord(req.params.userId);
  res.json({ user_id: rec.userId, data: rec.cis ?? {} });
});

/** POST /api/onboarding/cis */
router.post('/cis', async (req: AuthedRequest, res) => {
  const body = req.body ?? {};
  const userId = String(body.user_id ?? body.userId ?? req.userId);
  const access = await assertUserOnboardingAccess(req, userId);
  if (access === null) return res.status(404).json({ error: 'Not found' });
  if (access === false) return res.status(403).json({ error: 'Forbidden' });
  const payload = jsonPayload(body as Record<string, unknown>);
  const rec = await prisma.onboardingRecord.upsert({
    where: { userId },
    create: { userId, status: 'pending', cis: payload },
    update: { cis: payload },
  });
  res.json(S.onboardingRecord(rec));
});

/** Admin / superadmin / supervisor: send in-app notification to complete onboarding (staff & supervisors only). */
router.post('/remind/:userId', async (req: AuthedRequest, res) => {
  if (!['admin', 'superadmin', 'supervisor'].includes(effectiveRole(req))) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const targetUserId = req.params.userId;
  const target = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!target) return res.status(404).json({ error: 'Not found' });
  if (req.userRole !== 'superadmin' && target.companyId !== req.companyId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (target.role !== 'staff' && target.role !== 'supervisor') {
    return res.status(400).json({ error: 'Reminders apply only to staff and supervisors' });
  }
  const rec = await getOrCreateRecord(targetUserId);
  if (rec.completedAt) {
    return res.status(400).json({ error: 'Onboarding already completed' });
  }
  const cooldownH = Number(process.env.ONBOARDING_REMINDER_COOLDOWN_HOURS ?? 24);
  const hasCooldown = Number.isFinite(cooldownH) && cooldownH > 0;
  if (
    hasCooldown &&
    rec.lastReminderAt &&
    Date.now() - rec.lastReminderAt.getTime() < cooldownH * 60 * 60 * 1000
  ) {
    return res.status(429).json({ error: 'A reminder was sent recently. Try again later.' });
  }
  const io = req.app.get('io') as IoServer | undefined;
  await createNotification(prisma, io, {
    userId: targetUserId,
    title: 'Complete your onboarding',
    body: 'Please finish your onboarding forms in the app (Onboarding section). Your administrator has requested this.',
    type: 'warning',
    actionRoute: 'Onboarding',
  });
  await prisma.onboardingRecord.update({
    where: { id: rec.id },
    data: { lastReminderAt: new Date() },
  });
  res.json({ ok: true, message: 'Reminder sent' });
});

router.get('/', async (req: AuthedRequest, res) => {
  const where =
    req.userRole === 'superadmin'
      ? {}
      : {
          user: { companyId: req.companyId! },
        };
  const list = await prisma.onboardingRecord.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: {
      user: { select: { firstName: true, lastName: true, email: true, role: true } },
    },
  });
  res.json(list.map(S.onboardingRecord));
});

router.post('/', async (req: AuthedRequest, res) => {
  if (!['admin', 'superadmin'].includes(effectiveRole(req))) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const body = req.body ?? {};
  const userId = body.user_id ?? body.userId;
  if (!userId) return res.status(400).json({ error: 'user_id required' });
  const u = await prisma.user.findUnique({ where: { id: userId } });
  if (!u || (req.userRole !== 'superadmin' && u.companyId !== req.companyId)) {
    return res.status(400).json({ error: 'Invalid user' });
  }
  const o = await prisma.onboardingRecord.upsert({
    where: { userId },
    create: {
      userId,
      status: body.status ?? 'pending',
    },
    update: {
      status: body.status != null ? String(body.status) : undefined,
    },
  });
  res.status(201).json(S.onboardingRecord(o));
});

router.put('/:id', async (req: AuthedRequest, res) => {
  const existing = await prisma.onboardingRecord.findUnique({
    where: { id: req.params.id },
    include: { user: true },
  });
  if (!existing) return res.status(404).json({ error: 'Not found' });
  if (req.userRole !== 'superadmin' && existing.user.companyId !== req.companyId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (!['admin', 'superadmin'].includes(effectiveRole(req)) && req.userId !== existing.userId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const body = req.body ?? {};
  const data: Prisma.OnboardingRecordUpdateInput = {
    status: body.status != null ? String(body.status) : undefined,
    completedAt: body.completed_at ? new Date(body.completed_at) : body.completedAt === null ? null : undefined,
    newStarter: body.new_starter !== undefined ? body.new_starter : body.newStarter,
    qualifications: body.qualifications,
    policies: body.policies,
    cis: body.cis,
  };
  const o = await prisma.onboardingRecord.update({
    where: { id: req.params.id },
    data,
  });
  res.json(S.onboardingRecord(o));
});

export default router;
