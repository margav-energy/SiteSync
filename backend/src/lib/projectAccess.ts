import type { Prisma, Project } from '@prisma/client';
import { effectiveRole, type AuthedRequest } from '../middleware/auth';

/** Prisma `where` for projects the current user may list (GET /projects). */
export function prismaWhereVisibleProjects(req: AuthedRequest): Prisma.ProjectWhereInput {
  if (req.userRole === 'superadmin') return {};
  if (effectiveRole(req) === 'admin') {
    return { companyId: req.companyId!, createdByUserId: req.userId! };
  }
  return {
    companyId: req.companyId!,
    OR: [{ supervisorId: req.userId! }, { assignedStaffId: req.userId! }],
  };
}

/** GET /projects — who may see this project in lists and detail. */
export function canViewProject(req: AuthedRequest, p: Project): boolean {
  if (req.userRole === 'superadmin') return true;
  if (p.companyId !== req.companyId) return false;
  const uid = req.userId!;
  if (effectiveRole(req) === 'admin') {
    return p.createdByUserId === uid;
  }
  return p.supervisorId === uid || p.assignedStaffId === uid;
}

/** PUT/DELETE /projects — only creating admin (or superadmin). */
export function canAdminMutateProject(req: AuthedRequest, p: Project): boolean {
  if (req.userRole === 'superadmin') return true;
  if (effectiveRole(req) !== 'admin') return false;
  return p.createdByUserId === req.userId;
}

/**
 * Sign-in/out, job completions, etc.: the worker must be the assigned supervisor or assigned staff.
 * Admins impersonating / posting on behalf should still pass the target user's id check.
 */
export function canUserWorkOnProject(userId: string, p: Project): boolean {
  return p.supervisorId === userId || p.assignedStaffId === userId;
}
