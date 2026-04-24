import { prisma } from '../db';
import { getValidAccessTokenForCompany } from '../services/xeroConnectionService';

/** Proactively refresh access tokens before expiry (runs in-process; use a real scheduler in production). */
export function startXeroTokenRefreshJob(): void {
  if (process.env.XERO_TOKEN_REFRESH_JOB !== 'true') {
    return;
  }
  const intervalMs = Number(process.env.XERO_TOKEN_REFRESH_INTERVAL_MS) || 60 * 60 * 1000;
  setInterval(async () => {
    const rows = await prisma.xeroConnection.findMany({
      where: { status: 'active', xeroTenantId: { not: null } },
      select: { companyId: true, accessTokenExpiresAt: true },
    });
    const horizon = Date.now() + 15 * 60 * 1000;
    for (const row of rows) {
      const exp = row.accessTokenExpiresAt?.getTime() ?? 0;
      if (exp > horizon) continue;
      try {
        await getValidAccessTokenForCompany(row.companyId);
      } catch {
        // xeroConnectionService marks reauth_required and logs audit
      }
    }
  }, intervalMs);
}
