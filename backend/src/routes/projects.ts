import { Router } from 'express';
import type { Prisma, UserRole } from '@prisma/client';
import type { Server as IoServer } from 'socket.io';
import { prisma } from '../db';
import type { AuthedRequest } from '../middleware/auth';
import { authMiddleware, effectiveRole } from '../middleware/auth';
import * as S from '../lib/serialize';
import { createNotification } from '../lib/createNotification';
import {
  canAdminMutateProject,
  canViewProject,
  prismaWhereVisibleProjects,
} from '../lib/projectAccess';

const router = Router();
router.use(authMiddleware);

/** Reject bare "lat, lng" strings used as address. */
function isCoordinatesOnlyAddress(addr: string | undefined): boolean {
  if (!addr || !addr.trim()) return false;
  const s = addr.trim();
  return /^-?\d+\.?\d*\s*,\s*-?\d+\.?\d*$/.test(s);
}

async function assertProjectAccess(req: AuthedRequest, projectId: string) {
  const p = await prisma.project.findUnique({ where: { id: projectId } });
  if (!p) return null;
  if (!canViewProject(req, p)) return false;
  return p;
}

async function notifyProjectAssignment(
  req: AuthedRequest,
  params: { projectName: string; staffUserId?: string | null; supervisorUserId?: string | null }
) {
  const io = req.app.get('io') as IoServer | undefined;
  const actor = await prisma.user.findUnique({
    where: { id: req.userId! },
    select: { firstName: true, lastName: true, email: true },
  });
  const actorName =
    `${actor?.firstName ?? ''} ${actor?.lastName ?? ''}`.trim() || actor?.email || 'An admin';

  const targets = new Set<string>();
  if (params.staffUserId) targets.add(params.staffUserId);
  if (params.supervisorUserId) targets.add(params.supervisorUserId);
  targets.delete(req.userId!);

  await Promise.all(
    Array.from(targets).map((userId) =>
      createNotification(prisma, io, {
        userId,
        title: 'Project assignment updated',
        body: `${actorName} assigned you to project "${params.projectName}".`,
        type: 'info',
        actionRoute: 'DashboardHome',
      })
    )
  );
}

/** Optional project assignment: user must belong to the same company and have an allowed role. */
async function resolveAssignedUser(
  companyId: string,
  raw: unknown,
  allowedRoles: UserRole[]
): Promise<{ ok: true; id: string | null } | { ok: false; error: string }> {
  if (raw === undefined || raw === null || raw === '') {
    return { ok: true, id: null };
  }
  const userId = String(raw);
  const u = await prisma.user.findUnique({ where: { id: userId } });
  if (!u || u.companyId !== companyId) {
    return { ok: false, error: 'Invalid user for assignment' };
  }
  if (!allowedRoles.includes(u.role)) {
    const need = allowedRoles.join(' or ');
    return { ok: false, error: `User must have role: ${need}` };
  }
  return { ok: true, id: u.id };
}

router.get('/', async (req: AuthedRequest, res) => {
  let where: Prisma.ProjectWhereInput = prismaWhereVisibleProjects(req);
  if (req.userRole === 'superadmin') {
    const qUserId = req.query.userId as string | undefined;
    if (qUserId) {
      const u = await prisma.user.findUnique({ where: { id: qUserId } });
      where = u ? { companyId: u.companyId } : { id: { in: [] } };
    } else {
      where = {};
    }
  }
  const list = await prisma.project.findMany({ where, orderBy: { name: 'asc' } });
  res.json(list.map(S.project));
});

router.get('/:id', async (req: AuthedRequest, res) => {
  const p = await assertProjectAccess(req, req.params.id);
  if (p === null) return res.status(404).json({ error: 'Not found' });
  if (p === false) return res.status(403).json({ error: 'Forbidden' });
  res.json(S.project(p));
});

router.post('/', async (req: AuthedRequest, res) => {
  if (!['admin', 'superadmin'].includes(effectiveRole(req))) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const body = req.body ?? {};
  const name = body.name;
  let companyId = body.company_id ?? body.companyId ?? req.companyId;
  const qUserId = req.query.userId as string | undefined;
  const createdByUserId = body.created_by_user_id ?? body.createdByUserId;
  if (!companyId && qUserId) {
    const u = await prisma.user.findUnique({ where: { id: String(qUserId) } });
    companyId = u?.companyId;
  }
  if (!companyId && createdByUserId) {
    const u = await prisma.user.findUnique({ where: { id: String(createdByUserId) } });
    companyId = u?.companyId;
  }
  if (req.userRole !== 'superadmin') {
    companyId = req.companyId;
  }
  if (!name || !companyId) return res.status(400).json({ error: 'name and company required' });

  const address = body.address != null ? String(body.address) : undefined;
  if (isCoordinatesOnlyAddress(address)) {
    return res.status(400).json({ error: 'Address cannot be coordinates only; enter a real address' });
  }

  const photoUrls: string[] = Array.isArray(body.photo_urls)
    ? body.photo_urls.map(String)
    : Array.isArray(body.photoUrls)
      ? body.photoUrls.map(String)
      : [];

  const latitude = body.latitude != null ? Number(body.latitude) : undefined;
  const longitude = body.longitude != null ? Number(body.longitude) : undefined;
  const allowedRadiusMeters =
    body.allowed_radius_meters != null
      ? Number(body.allowed_radius_meters)
      : body.allowedRadiusMeters != null
        ? Number(body.allowedRadiusMeters)
        : undefined;
  const projectType = body.project_type === 'callout' || body.projectType === 'callout' ? 'callout' : 'regular';
  const category = body.category != null ? String(body.category) : undefined;
  const startDate =
    body.start_date != null
      ? new Date(body.start_date)
      : body.startDate != null
        ? new Date(body.startDate)
        : undefined;

  const supervisorRaw = body.supervisor_id ?? body.supervisorId;
  const staffRaw = body.assigned_staff_id ?? body.assignedStaffId;
  const sup = await resolveAssignedUser(companyId, supervisorRaw, ['supervisor']);
  if (!sup.ok) return res.status(400).json({ error: sup.error });
  const stf = await resolveAssignedUser(companyId, staffRaw, ['staff', 'supervisor']);
  if (!stf.ok) return res.status(400).json({ error: stf.error });
  if (sup.id && stf.id && sup.id === stf.id) {
    return res.status(400).json({ error: 'Supervisor and assigned staff must be different users' });
  }

  const p = await prisma.project.create({
    data: {
      name: String(name),
      companyId,
      createdByUserId: req.userId!,
      address: address ?? null,
      latitude: latitude != null && !Number.isNaN(latitude) ? latitude : null,
      longitude: longitude != null && !Number.isNaN(longitude) ? longitude : null,
      ...(allowedRadiusMeters != null &&
        !Number.isNaN(allowedRadiusMeters) &&
        allowedRadiusMeters > 0 && { allowedRadiusMeters }),
      projectType,
      category: category ?? null,
      startDate: startDate && !Number.isNaN(startDate.getTime()) ? startDate : null,
      photoUrls,
      supervisorId: sup.id,
      assignedStaffId: stf.id,
    },
  });
  await notifyProjectAssignment(req, {
    projectName: p.name,
    staffUserId: p.assignedStaffId,
    supervisorUserId: p.supervisorId,
  });
  res.status(201).json(S.project(p));
});

router.put('/:id', async (req: AuthedRequest, res) => {
  const existing = await assertProjectAccess(req, req.params.id);
  if (existing === null) return res.status(404).json({ error: 'Not found' });
  if (existing === false) return res.status(403).json({ error: 'Forbidden' });
  if (!['admin', 'superadmin'].includes(effectiveRole(req))) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (!canAdminMutateProject(req, existing)) {
    return res.status(403).json({ error: 'Only the admin who created this project can edit it' });
  }
  const body = req.body ?? {};
  const name = body.name;
  const address = body.address != null ? String(body.address) : undefined;
  if (address !== undefined && isCoordinatesOnlyAddress(address)) {
    return res.status(400).json({ error: 'Address cannot be coordinates only; enter a real address' });
  }
  const photoUrls = Array.isArray(body.photo_urls)
    ? body.photo_urls.map(String)
    : Array.isArray(body.photoUrls)
      ? body.photoUrls.map(String)
      : undefined;
  const latitude = body.latitude != null ? Number(body.latitude) : undefined;
  const longitude = body.longitude != null ? Number(body.longitude) : undefined;
  const allowedRadiusMeters =
    body.allowed_radius_meters != null
      ? Number(body.allowed_radius_meters)
      : body.allowedRadiusMeters != null
        ? Number(body.allowedRadiusMeters)
        : undefined;
  const projectType =
    body.project_type === 'callout' || body.projectType === 'callout'
      ? 'callout'
      : body.project_type === 'regular' || body.projectType === 'regular'
        ? 'regular'
        : undefined;
  const category = body.category != null ? String(body.category) : undefined;
  const startDate =
    body.start_date != null
      ? new Date(body.start_date)
      : body.startDate != null
        ? new Date(body.startDate)
        : undefined;

  const companyId = existing.companyId;
  let supervisorIdUpdate: string | null | undefined;
  let assignedStaffIdUpdate: string | null | undefined;
  if (body.supervisor_id !== undefined || body.supervisorId !== undefined) {
    const sup = await resolveAssignedUser(
      companyId,
      body.supervisor_id ?? body.supervisorId,
      ['supervisor']
    );
    if (!sup.ok) return res.status(400).json({ error: sup.error });
    supervisorIdUpdate = sup.id;
  }
  if (body.assigned_staff_id !== undefined || body.assignedStaffId !== undefined) {
    const stf = await resolveAssignedUser(
      companyId,
      body.assigned_staff_id ?? body.assignedStaffId,
      ['staff', 'supervisor']
    );
    if (!stf.ok) return res.status(400).json({ error: stf.error });
    assignedStaffIdUpdate = stf.id;
  }
  const nextSupervisorId =
    supervisorIdUpdate !== undefined ? supervisorIdUpdate : existing.supervisorId;
  const nextStaffId =
    assignedStaffIdUpdate !== undefined ? assignedStaffIdUpdate : existing.assignedStaffId;
  if (nextSupervisorId && nextStaffId && nextSupervisorId === nextStaffId) {
    return res.status(400).json({ error: 'Supervisor and assigned staff must be different users' });
  }

  const p = await prisma.project.update({
    where: { id: req.params.id },
    data: {
      ...(name != null && { name: String(name) }),
      ...(address !== undefined && { address: address || null }),
      ...(latitude !== undefined && { latitude: Number.isNaN(latitude) ? null : latitude }),
      ...(longitude !== undefined && { longitude: Number.isNaN(longitude) ? null : longitude }),
      ...(allowedRadiusMeters !== undefined &&
        !Number.isNaN(allowedRadiusMeters) &&
        allowedRadiusMeters > 0 && { allowedRadiusMeters }),
      ...(projectType !== undefined && { projectType }),
      ...(category !== undefined && { category: category || null }),
      ...(startDate !== undefined && {
        startDate: startDate && !Number.isNaN(startDate.getTime()) ? startDate : null,
      }),
      ...(photoUrls !== undefined && { photoUrls }),
      ...(supervisorIdUpdate !== undefined && { supervisorId: supervisorIdUpdate }),
      ...(assignedStaffIdUpdate !== undefined && { assignedStaffId: assignedStaffIdUpdate }),
    },
  });
  const shouldNotifyStaff =
    assignedStaffIdUpdate !== undefined &&
    p.assignedStaffId != null &&
    p.assignedStaffId !== existing.assignedStaffId;
  const shouldNotifySupervisor =
    supervisorIdUpdate !== undefined &&
    p.supervisorId != null &&
    p.supervisorId !== existing.supervisorId;
  if (shouldNotifyStaff || shouldNotifySupervisor) {
    await notifyProjectAssignment(req, {
      projectName: p.name,
      staffUserId: shouldNotifyStaff ? p.assignedStaffId : null,
      supervisorUserId: shouldNotifySupervisor ? p.supervisorId : null,
    });
  }
  res.json(S.project(p));
});

router.delete('/:id', async (req: AuthedRequest, res) => {
  const existing = await assertProjectAccess(req, req.params.id);
  if (existing === null) return res.status(404).json({ error: 'Not found' });
  if (existing === false) return res.status(403).json({ error: 'Forbidden' });
  if (!['admin', 'superadmin'].includes(effectiveRole(req))) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (!canAdminMutateProject(req, existing)) {
    return res.status(403).json({ error: 'Only the admin who created this project can delete it' });
  }
  await prisma.project.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

router.put('/:id/archive', async (req: AuthedRequest, res) => {
  const existing = await assertProjectAccess(req, req.params.id);
  if (existing === null) return res.status(404).json({ error: 'Not found' });
  if (existing === false) return res.status(403).json({ error: 'Forbidden' });
  if (!existing.completed) {
    return res.status(400).json({ error: 'Project must be completed by admin before archiving' });
  }
  const archived = Boolean(req.body?.archived ?? true);
  const p = await prisma.project.update({
    where: { id: req.params.id },
    data: {
      archived,
      archivedAt: archived ? new Date() : null,
    },
  });
  res.json(S.project(p));
});

export default router;
