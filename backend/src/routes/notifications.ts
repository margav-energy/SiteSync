import { Router } from 'express';
import { prisma } from '../db';
import type { AuthedRequest } from '../middleware/auth';
import { authMiddleware } from '../middleware/auth';
import * as S from '../lib/serialize';

const router = Router();
router.use(authMiddleware);

router.get('/', async (req: AuthedRequest, res) => {
  const list = await prisma.notification.findMany({
    where: { userId: req.userId! },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  res.json(list.map(S.notification));
});

router.put('/:id/read', async (req: AuthedRequest, res) => {
  const n = await prisma.notification.findFirst({
    where: { id: req.params.id, userId: req.userId! },
  });
  if (!n) return res.status(404).json({ error: 'Not found' });
  await prisma.notification.update({
    where: { id: req.params.id },
    data: { read: true },
  });
  res.status(204).send();
});

router.delete('/:id', async (req: AuthedRequest, res) => {
  const n = await prisma.notification.findFirst({
    where: { id: req.params.id, userId: req.userId! },
  });
  if (!n) return res.status(404).json({ error: 'Not found' });
  await prisma.notification.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

export default router;
