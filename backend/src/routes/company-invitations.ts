import { randomBytes } from 'crypto';
import { Router } from 'express';
import type { UserRole } from '@prisma/client';
import { prisma } from '../db';
import { sendInvitationCodeEmail } from '../lib/invitationEmails';
import type { AuthedRequest } from '../middleware/auth';
import { authMiddleware, effectiveRole } from '../middleware/auth';

const router = Router();
const normalizeToken = (raw: string) => raw.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

/** Public: validate invitation token (Flutter: GET /api/company-invitations/token/:token) */
router.get('/token/:token', async (req, res) => {
  const raw = String(req.params.token ?? '').trim();
  if (!raw) return res.status(400).json({ error: 'token required' });
  const token = normalizeToken(raw);
  const inv = await prisma.companyInvitation.findUnique({ where: { token } });
  if (!inv) {
    return res.status(404).json({ error: 'Invalid or expired invitation' });
  }
  if (inv.usedAt) {
    return res.status(400).json({ error: 'Invitation already used' });
  }
  if (inv.expiresAt < new Date()) {
    return res.status(400).json({ error: 'Invitation expired' });
  }
  return res.json({
    id: inv.id,
    email: inv.email,
    role: inv.role,
    company_id: inv.companyId,
    expires_at: inv.expiresAt.toISOString(),
  });
});

/** Public: request invitation code email resend for an existing pending invitation. */
router.post('/request-code', async (req, res) => {
  const body = req.body ?? {};
  const email = String(body.email ?? '').toLowerCase().trim();
  if (!email) {
    return res.status(400).json({ error: 'email required' });
  }

  try {
    const invitation = await prisma.companyInvitation.findFirst({
      where: {
        email,
        role: 'admin',
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!invitation) {
      return res.json({
        ok: false,
        reason: 'not_found',
        email_sent: false,
        message: 'No active admin invitation found for this email. Ask your superadmin to create one.',
      });
    }

    let emailSent = false;
    try {
      emailSent = await sendInvitationCodeEmail({
        email: invitation.email,
        token: invitation.token,
        role: invitation.role,
        expiresAt: invitation.expiresAt,
      });
    } catch (error) {
      console.error('[invitation-email] failed to resend invitation code', error);
    }

    return res.json({
      ok: emailSent,
      reason: emailSent ? 'sent' : 'delivery_unavailable',
      email_sent: emailSent,
      message: emailSent
        ? 'Invitation code sent. Please check your inbox.'
        : 'Admin invitation found, but email delivery failed. Please contact support or try again.',
    });
  } catch (error) {
    console.error('[invitation-request] failed to look up invitation', error);
    return res.status(503).json({ error: 'Service temporarily unavailable. Please try again shortly.' });
  }
});

router.use(authMiddleware);

router.post('/', async (req: AuthedRequest, res) => {
  if (!['admin', 'superadmin'].includes(effectiveRole(req))) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const body = req.body ?? {};
  const email = String(body.email ?? '').toLowerCase().trim();
  const role = (body.role ?? 'staff') as UserRole;
  let companyId = body.company_id ?? body.companyId ?? req.companyId;
  if (req.userRole !== 'superadmin') {
    companyId = req.companyId;
  }
  const days = Number(body.expires_in_days ?? body.expiresInDays ?? 14) || 14;
  if (!email || !companyId) {
    return res.status(400).json({ error: 'email and company_id required' });
  }

  const token = randomBytes(8).toString('hex').toUpperCase();
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

  const inv = await prisma.companyInvitation.create({
    data: {
      token,
      email,
      role,
      companyId,
      expiresAt,
    },
  });

  let emailSent = false;
  try {
    emailSent = await sendInvitationCodeEmail({
      email: inv.email,
      token: inv.token,
      role: inv.role,
      expiresAt: inv.expiresAt,
    });
  } catch (error) {
    console.error('[invitation-email] failed to send invitation code', error);
  }

  return res.status(201).json({
    id: inv.id,
    token: inv.token,
    email: inv.email,
    role: inv.role,
    company_id: inv.companyId,
    expires_at: inv.expiresAt.toISOString(),
    email_sent: emailSent,
  });
});

/** Mark invitation used (e.g. legacy flow after POST /users). Idempotent if already used. */
router.put('/:id/use', async (req: AuthedRequest, res) => {
  const inv = await prisma.companyInvitation.findUnique({ where: { id: req.params.id } });
  if (!inv) return res.status(404).json({ error: 'Not found' });
  if (req.userRole !== 'superadmin' && inv.companyId !== req.companyId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const updated = await prisma.companyInvitation.update({
    where: { id: inv.id },
    data: { usedAt: inv.usedAt ?? new Date() },
  });
  return res.json({
    id: updated.id,
    used_at: updated.usedAt?.toISOString(),
  });
});

export default router;
