import { Router } from 'express';
import Expo from 'expo-server-sdk';
import { prisma } from '../db';
import type { AuthedRequest } from '../middleware/auth';
import { authMiddleware } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

/** POST /api/push/register — store Expo push token for the current user (replaces previous). */
router.post('/register', async (req: AuthedRequest, res) => {
  const raw = String(req.body?.expo_push_token ?? req.body?.token ?? '').trim();
  if (!raw) {
    return res.status(400).json({ error: 'expo_push_token required' });
  }
  if (!Expo.isExpoPushToken(raw)) {
    return res.status(400).json({ error: 'Invalid Expo push token' });
  }
  await prisma.user.update({
    where: { id: req.userId! },
    data: { expoPushToken: raw },
  });
  res.json({ ok: true });
});

/** POST /api/push/unregister — clear token (e.g. on logout). */
router.post('/unregister', async (req: AuthedRequest, res) => {
  await prisma.user.update({
    where: { id: req.userId! },
    data: { expoPushToken: null },
  });
  res.json({ ok: true });
});

export default router;
