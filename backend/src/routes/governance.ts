import { Router } from 'express';
import { prisma } from '../db';
import type { AuthedRequest } from '../middleware/auth';
import { authMiddleware } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

router.use((req: AuthedRequest, res, next) => {
  if (req.userRole !== 'superadmin') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
});

router.get('/summary', async (_req, res) => {
  const [companies, activeUsers, projects, incidents, pendingApprovals] = await Promise.all([
    prisma.company.count({ where: { isArchived: false } }),
    prisma.user.count({ where: { isActive: true } }),
    prisma.project.count({ where: { archived: false } }),
    prisma.incident.count(),
    prisma.jobCompletion.count({ where: { status: 'pending' } }),
  ]);
  res.json({
    companies,
    active_users: activeUsers,
    projects,
    incidents,
    pending_approvals: pendingApprovals,
  });
});

router.get('/incidents-overview', async (_req, res) => {
  const severe = await prisma.incident.findMany({
    where: {
      status: { not: 'resolved' },
      severity: { in: ['high', 'critical'] },
    },
    include: { user: { include: { company: true } } },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  res.json({
    severe_unresolved: severe.map((i) => ({
      id: i.id,
      description: i.description,
      severity: i.severity,
      status: i.status,
      company_id: i.user.companyId,
      company_name: i.user.company.name,
      created_at: i.createdAt.toISOString(),
    })),
  });
});

router.get('/compliance-overview', async (_req, res) => {
  const records = await prisma.onboardingRecord.findMany({
    include: { user: { include: { company: true } } },
  });
  const totals = new Map<string, { company_id: string; company_name: string; pending: number; completed: number }>();
  for (const record of records) {
    const key = record.user.companyId;
    const bucket =
      totals.get(key) ??
      { company_id: key, company_name: record.user.company.name, pending: 0, completed: 0 };
    if (record.completedAt) bucket.completed += 1;
    else bucket.pending += 1;
    totals.set(key, bucket);
  }
  res.json({ by_company: Array.from(totals.values()) });
});

export default router;
