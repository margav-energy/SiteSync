import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../db';
import type { UserRole } from '@prisma/client';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

export interface AuthPayload {
  sub: string;
}

export interface AuthedRequest extends Request {
  userId?: string;
  userRole?: UserRole;
  /** Role in the active company (from CompanyMembership). Undefined for superadmin. */
  membershipRole?: UserRole;
  companyId?: string;
}

export function signToken(userId: string): string {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): AuthPayload {
  return jwt.verify(token, JWT_SECRET) as AuthPayload;
}

/** Role for company-scoped authorization. Superadmin is always global; others use membership when set. */
export function effectiveRole(req: AuthedRequest): UserRole {
  if (req.userRole === 'superadmin') return 'superadmin';
  return req.membershipRole ?? req.userRole!;
}

export async function authMiddleware(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization' });
  }
  const token = header.slice(7);
  try {
    const { sub } = verifyToken(token);
    const user = await prisma.user.findUnique({ where: { id: sub } });
    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Invalid user' });
    }
    req.userId = user.id;
    req.userRole = user.role;
    req.membershipRole = undefined;

    if (user.role === 'superadmin') {
      const headerCo = (req.headers['x-company-id'] as string | undefined)?.trim();
      if (headerCo) {
        const c = await prisma.company.findUnique({ where: { id: headerCo } });
        if (!c) return res.status(403).json({ error: 'Invalid company' });
        req.companyId = headerCo;
      }
      next();
      return;
    }

    const headerCo = (req.headers['x-company-id'] as string | undefined)?.trim();
    const requested = headerCo || user.companyId;

    const membership = await prisma.companyMembership.findUnique({
      where: { userId_companyId: { userId: user.id, companyId: requested } },
    });
    if (!membership) {
      return res.status(403).json({ error: 'No access to this company' });
    }
    req.companyId = membership.companyId;
    req.membershipRole = membership.role;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

export function requireRole(...roles: UserRole[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    const r = effectiveRole(req);
    if (!r || !roles.includes(r)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}
