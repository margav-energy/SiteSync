import { Router } from 'express';
import { prisma } from '../db';
import type { AuthedRequest } from '../middleware/auth';
import { authMiddleware } from '../middleware/auth';
import * as S from '../lib/serialize';

const router = Router();
router.use(authMiddleware);

router.get('/', async (req: AuthedRequest, res) => {
  if (req.userRole === 'superadmin') {
    const includeArchived = req.query.include_archived === 'true';
    const list = await prisma.company.findMany({
      where: includeArchived ? {} : { isArchived: false },
      orderBy: { name: 'asc' },
    });
    return res.json(list.map(S.company));
  }
  const memberships = await prisma.companyMembership.findMany({
    where: { userId: req.userId! },
    include: { company: true },
    orderBy: { company: { name: 'asc' } },
  });
  res.json(memberships.map((m) => S.company(m.company)));
});

router.get('/:id', async (req: AuthedRequest, res) => {
  const c = await prisma.company.findUnique({ where: { id: req.params.id } });
  if (!c) return res.status(404).json({ error: 'Not found' });
  if (req.userRole === 'superadmin') {
    return res.json(S.company(c));
  }
  const membership = await prisma.companyMembership.findUnique({
    where: { userId_companyId: { userId: req.userId!, companyId: req.params.id } },
  });
  if (!membership) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  res.json(S.company(c));
});

router.post('/', async (req: AuthedRequest, res) => {
  if (req.userRole !== 'superadmin' && req.userRole !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const name = req.body?.name;
  if (!name) return res.status(400).json({ error: 'name required' });
  const c = await prisma.company.create({ data: { name: String(name) } });
  if (req.userRole !== 'superadmin') {
    await prisma.companyMembership.create({
      data: { userId: req.userId!, companyId: c.id, role: 'admin' },
    });
  }
  res.status(201).json(S.company(c));
});

router.put('/:id', async (req: AuthedRequest, res) => {
  if (req.userRole !== 'superadmin') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const name = req.body?.name;
  const c = await prisma.company.update({
    where: { id: req.params.id },
    data: { name: name != null ? String(name) : undefined },
  });
  res.json(S.company(c));
});

router.patch('/:id/status', async (req: AuthedRequest, res) => {
  if (req.userRole !== 'superadmin') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const body = req.body ?? {};
  const c = await prisma.company.update({
    where: { id: req.params.id },
    data: {
      ...(body.is_active != null && { isActive: Boolean(body.is_active) }),
      ...(body.is_suspended != null && { isSuspended: Boolean(body.is_suspended) }),
      ...(body.is_archived != null && { isArchived: Boolean(body.is_archived) }),
    },
  });
  res.json(S.company(c));
});

router.get('/:id/admins', async (req: AuthedRequest, res) => {
  const company = await prisma.company.findUnique({ where: { id: req.params.id } });
  if (!company) return res.status(404).json({ error: 'Not found' });
  if (req.userRole !== 'superadmin') {
    const membership = await prisma.companyMembership.findUnique({
      where: { userId_companyId: { userId: req.userId!, companyId: req.params.id } },
    });
    if (!membership) return res.status(403).json({ error: 'Forbidden' });
  }
  const admins = await prisma.user.findMany({
    where: { companyId: req.params.id, role: 'admin' },
    orderBy: { createdAt: 'desc' },
  });
  res.json(admins.map(S.user));
});

router.post('/:id/admins', async (req: AuthedRequest, res) => {
  if (req.userRole !== 'superadmin') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const userId = String(req.body?.user_id ?? req.body?.userId ?? '').trim();
  if (!userId) return res.status(400).json({ error: 'user_id required' });
  const company = await prisma.company.findUnique({ where: { id: req.params.id } });
  if (!company) return res.status(404).json({ error: 'Not found' });
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return res.status(404).json({ error: 'User not found' });
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { role: 'admin', companyId: req.params.id },
  });
  await prisma.companyMembership.upsert({
    where: { userId_companyId: { userId, companyId: req.params.id } },
    create: { userId, companyId: req.params.id, role: 'admin' },
    update: { role: 'admin' },
  });
  res.json(S.user(updated));
});

router.delete('/:id', async (req: AuthedRequest, res) => {
  if (req.userRole !== 'superadmin') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  await prisma.company.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

export default router;
