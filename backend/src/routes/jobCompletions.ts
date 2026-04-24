import { Router } from 'express';
import type { Server as IoServer } from 'socket.io';
import { prisma } from '../db';
import type { AuthedRequest } from '../middleware/auth';
import { authMiddleware, effectiveRole } from '../middleware/auth';
import * as S from '../lib/serialize';
import { canUserWorkOnProject, prismaWhereVisibleProjects } from '../lib/projectAccess';
import { createNotification } from '../lib/createNotification';

const router = Router();
router.use(authMiddleware);

router.get('/', async (req: AuthedRequest, res) => {
  const where =
    req.userRole === 'superadmin'
      ? {}
      : {
          project: prismaWhereVisibleProjects(req),
        };
  const list = await prisma.jobCompletion.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  res.json(list.map(S.jobCompletion));
});

router.post('/', async (req: AuthedRequest, res) => {
  const body = req.body ?? {};
  const userId = body.user_id ?? body.userId ?? req.userId;
  const projectId = body.project_id ?? body.projectId;
  const description = body.description;
  if (!projectId || !description) {
    return res.status(400).json({ error: 'project_id and description required' });
  }
  if (userId !== req.userId && !['admin', 'superadmin'].includes(effectiveRole(req))) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const role = effectiveRole(req);
  if (!['staff', 'supervisor', 'admin', 'superadmin'].includes(role)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project || (req.userRole !== 'superadmin' && project.companyId !== req.companyId)) {
    return res.status(400).json({ error: 'Invalid project' });
  }
  if (
    req.userRole !== 'superadmin' &&
    !canUserWorkOnProject(userId, project)
  ) {
    return res.status(403).json({ error: 'Only the assigned supervisor or staff can submit for this project' });
  }

  const photoUrls = Array.isArray(body.photo_urls)
    ? body.photo_urls.filter((u: unknown) => typeof u === 'string' && u.trim().length > 0)
    : [];
  if (photoUrls.length === 0) {
    return res.status(400).json({ error: 'At least one photo is required for job completion' });
  }

  const j = await prisma.jobCompletion.create({
    data: {
      userId,
      projectId,
      description: String(description),
      photoUrls,
    },
  });
  const io = req.app.get('io') as IoServer | undefined;
  if (project.supervisorId && project.supervisorId !== req.userId) {
    await createNotification(prisma, io, {
      userId: project.supervisorId,
      title: 'Job completion submitted',
      body: 'A staff member submitted a job completion with photos. Please review and approve.',
      type: 'info',
      actionRoute: 'Jobs',
    });
  }
  res.status(201).json(S.jobCompletion(j));
});

router.put('/:id', async (req: AuthedRequest, res) => {
  const existing = await prisma.jobCompletion.findUnique({
    where: { id: req.params.id },
    include: { project: true },
  });
  if (!existing) return res.status(404).json({ error: 'Not found' });
  if (req.userRole !== 'superadmin' && existing.project.companyId !== req.companyId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const body = req.body ?? {};
  const j = await prisma.jobCompletion.update({
    where: { id: req.params.id },
    data: {
      description: body.description != null ? String(body.description) : undefined,
      photoUrls: Array.isArray(body.photo_urls) ? body.photo_urls : undefined,
    },
  });
  res.json(S.jobCompletion(j));
});

router.put('/:id/approve', async (req: AuthedRequest, res) => {
  const role = effectiveRole(req);
  if (!['supervisor', 'admin', 'superadmin'].includes(role)) {
    return res.status(403).json({ error: 'Only supervisors/admins can approve job completions' });
  }
  const existing = await prisma.jobCompletion.findUnique({
    where: { id: req.params.id },
    include: { project: true },
  });
  if (!existing) return res.status(404).json({ error: 'Not found' });
  if (req.userRole !== 'superadmin' && existing.project.companyId !== req.companyId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (role === 'supervisor' && existing.project.supervisorId !== req.userId) {
    return res.status(403).json({ error: 'Only assigned supervisor can approve this job completion' });
  }
  if (role === 'supervisor') {
    const j = await prisma.jobCompletion.update({
      where: { id: req.params.id },
      data: { status: 'supervisor_approved' },
    });
    if (req.companyId) {
      const io = req.app.get('io') as IoServer | undefined;
      const admins = await prisma.user.findMany({
        where: {
          companyId: req.companyId,
          isActive: true,
          role: { in: ['admin', 'superadmin'] },
        },
        select: { id: true },
      });
      await Promise.all(
        admins.map((u) =>
          createNotification(prisma, io, {
            userId: u.id,
            title: 'Supervisor sign-off received',
            body: 'A supervisor signed off a job completion. Admin final approval is required.',
            type: 'info',
            actionRoute: 'Jobs',
          })
        )
      );
    }
    return res.json(S.jobCompletion(j));
  }

  if (existing.status !== 'supervisor_approved') {
    return res.status(400).json({ error: 'Supervisor sign-off is required before admin final approval' });
  }
  const j = await prisma.jobCompletion.update({
    where: { id: req.params.id },
    data: { status: 'approved' },
  });
  await prisma.project.update({
    where: { id: existing.projectId },
    data: { completed: true, completedAt: new Date() },
  });
  if (req.companyId) {
    const io = req.app.get('io') as IoServer | undefined;
    const users = await prisma.user.findMany({
      where: {
        companyId: req.companyId,
        isActive: true,
      },
      select: { id: true },
    });
    await Promise.all(
      users.map((u) =>
        createNotification(prisma, io, {
          userId: u.id,
          title: 'Project marked completed',
          body: 'Admin gave final approval. This project can now be archived by any role.',
          type: 'success',
          actionRoute: 'Projects',
        })
      )
    );
  }
  res.json(S.jobCompletion(j));
});

export default router;
