import { Router } from 'express';
import type { Server as IoServer } from 'socket.io';
import { prisma } from '../db';
import type { AuthedRequest } from '../middleware/auth';
import { authMiddleware, effectiveRole } from '../middleware/auth';
import * as S from '../lib/serialize';
import { canViewProject, prismaWhereVisibleProjects } from '../lib/projectAccess';
import { createNotification } from '../lib/createNotification';

const router = Router();
router.use(authMiddleware);

const INCIDENT_SEVERITIES = new Set(['low', 'medium', 'high', 'critical']);

function normalizeSeverity(value: unknown): 'low' | 'medium' | 'high' | 'critical' {
  const raw = String(value ?? 'medium').trim().toLowerCase();
  if (INCIDENT_SEVERITIES.has(raw)) return raw as 'low' | 'medium' | 'high' | 'critical';
  return 'medium';
}

async function notifyCompanyUsers(
  req: AuthedRequest,
  title: string,
  body: string,
  type: 'info' | 'warning' | 'error' | 'success',
  actionRoute?: string
) {
  if (!req.companyId) return;
  const users = await prisma.user.findMany({
    where: {
      companyId: req.companyId,
      isActive: true,
    },
    select: { id: true },
  });
  const io = req.app.get('io') as IoServer | undefined;
  await Promise.all(
    users.map((u) =>
      createNotification(prisma, io, {
        userId: u.id,
        title,
        body,
        type,
        actionRoute,
      })
    )
  );
}

router.get('/', async (req: AuthedRequest, res) => {
  const where =
    req.userRole === 'superadmin'
      ? {}
      : {
          user: { companyId: req.companyId! },
          OR: [{ projectId: null }, { project: prismaWhereVisibleProjects(req) }],
        };
  const list = await prisma.incident.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  res.json(list.map(S.incident));
});

router.post('/', async (req: AuthedRequest, res) => {
  const role = effectiveRole(req);
  if (!['staff', 'supervisor', 'admin', 'superadmin'].includes(role)) {
    return res
      .status(403)
      .json({ error: 'Only staff, supervisors, or admins can report incidents' });
  }
  const body = req.body ?? {};
  const description = body.description;
  if (!description) return res.status(400).json({ error: 'description required' });
  const severity = normalizeSeverity(body.severity);
  const photoUrlRaw = body.photo_url ?? body.photoUrl;
  const photoUrl =
    typeof photoUrlRaw === 'string' && photoUrlRaw.trim().length > 0 ? photoUrlRaw.trim() : null;
  const projectId = body.project_id ?? body.projectId;
  if (projectId) {
    const p = await prisma.project.findUnique({ where: { id: projectId } });
    if (!p || (req.userRole !== 'superadmin' && p.companyId !== req.companyId)) {
      return res.status(400).json({ error: 'Invalid project' });
    }
    if (!canViewProject(req, p)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
  }
  const i = await prisma.incident.create({
    data: {
      userId: req.userId!,
      projectId: projectId ?? null,
      description: String(description),
      severity,
      photoUrl,
    },
  });
  await notifyCompanyUsers(
    req,
    'Incident reported',
    `A ${severity} severity incident has been reported and needs attention.`,
    severity === 'high' || severity === 'critical' ? 'error' : 'warning',
    'Incidents'
  );
  res.status(201).json(S.incident(i));
});

router.put('/:id', async (req: AuthedRequest, res) => {
  const existing = await prisma.incident.findUnique({
    where: { id: req.params.id },
    include: { user: true },
  });
  if (!existing) return res.status(404).json({ error: 'Not found' });
  if (req.userRole !== 'superadmin' && existing.user.companyId !== req.companyId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const body = req.body ?? {};
  const role = effectiveRole(req);
  const incomingStatus = body.status != null ? String(body.status).trim().toLowerCase() : undefined;
  if (incomingStatus === 'resolved' && !['admin', 'supervisor', 'superadmin'].includes(role)) {
    return res
      .status(403)
      .json({ error: 'Only admin or supervisor users can resolve incidents' });
  }
  const wasResolved = existing.status.toLowerCase() === 'resolved';
  const willBeResolved = incomingStatus === 'resolved';
  const resolutionReportRaw = body.resolution_report ?? body.resolutionReport;
  const resolutionPhotoRaw = body.resolution_photo_url ?? body.resolutionPhotoUrl;
  const resolutionReport =
    resolutionReportRaw != null ? String(resolutionReportRaw).trim() : undefined;
  const resolutionPhotoUrl =
    resolutionPhotoRaw != null ? String(resolutionPhotoRaw).trim() : undefined;
  if (!wasResolved && willBeResolved) {
    if (!resolutionReport) {
      return res.status(400).json({ error: 'resolution_report is required to resolve incident' });
    }
    if (!resolutionPhotoUrl) {
      return res
        .status(400)
        .json({ error: 'resolution_photo_url is required to resolve incident' });
    }
  }
  const i = await prisma.incident.update({
    where: { id: req.params.id },
    data: {
      description: body.description != null ? String(body.description) : undefined,
      status: body.status != null ? String(body.status) : undefined,
      severity: body.severity != null ? normalizeSeverity(body.severity) : undefined,
      photoUrl:
        body.photo_url != null || body.photoUrl != null
          ? String(body.photo_url ?? body.photoUrl ?? '').trim() || null
          : undefined,
      resolutionReport:
        resolutionReportRaw != null ? resolutionReport && resolutionReport.length > 0 ? resolutionReport : null : undefined,
      resolutionPhotoUrl:
        resolutionPhotoRaw != null
          ? resolutionPhotoUrl && resolutionPhotoUrl.length > 0
            ? resolutionPhotoUrl
            : null
          : undefined,
      resolvedByUserId: !wasResolved && willBeResolved ? req.userId! : undefined,
      resolvedAt: !wasResolved && willBeResolved ? new Date() : undefined,
    },
  });
  if (!wasResolved && willBeResolved) {
    await notifyCompanyUsers(
      req,
      'Incident resolved',
      'An incident has been marked as resolved by a supervisor or admin.',
      'success',
      'Incidents'
    );
  }
  res.json(S.incident(i));
});

export default router;
