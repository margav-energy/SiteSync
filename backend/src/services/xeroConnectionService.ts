import type { XeroConnection, XeroConnectionStatus } from '@prisma/client';
import { prisma } from '../db';
import { encryptAtRest, decryptAtRest } from '../lib/tokenEncryption';
import { logXeroAudit } from '../lib/xeroAudit';
import * as XeroOAuth from './xeroOAuth';

const REFRESH_TOKEN_TTL_DAYS = 60;

export type TokenBundle = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope?: string;
};

export function encryptTokenBundle(t: TokenBundle): { accessEnc: string; refreshEnc: string; expiresAt: Date } {
  const expiresAt = new Date(Date.now() + Math.max(60, t.expires_in) * 1000);
  return {
    accessEnc: encryptAtRest(t.access_token),
    refreshEnc: encryptAtRest(t.refresh_token),
    expiresAt,
  };
}

export function decryptRefreshToken(row: XeroConnection): string {
  if (!row.refreshTokenEnc) throw new Error('missing refresh token');
  return decryptAtRest(row.refreshTokenEnc);
}

export function decryptAccessToken(row: XeroConnection): string {
  if (!row.accessTokenEnc) throw new Error('missing access token');
  return decryptAtRest(row.accessTokenEnc);
}

/** Returns a valid access token, refreshing if needed. Company-scoped via row. */
export async function getValidAccessTokenForCompany(companyId: string): Promise<{ accessToken: string; row: XeroConnection }> {
  const row = await prisma.xeroConnection.findUnique({ where: { companyId } });
  if (!row || row.status !== 'active' || !row.xeroTenantId) {
    throw new Error('No active Xero connection for this company');
  }
  const now = Date.now();
  const skewMs = 120_000;
  if (
    row.accessTokenExpiresAt &&
    row.accessTokenExpiresAt.getTime() > now + skewMs &&
    row.accessTokenEnc
  ) {
    return { accessToken: decryptAccessToken(row), row };
  }
  return refreshAndPersistTokens(companyId);
}

async function refreshAndPersistTokens(companyId: string): Promise<{ accessToken: string; row: XeroConnection }> {
  const row = await prisma.xeroConnection.findUnique({ where: { companyId } });
  if (!row?.refreshTokenEnc) {
    throw new Error('No refresh token; reconnect Xero');
  }
  let refreshPlain: string;
  try {
    refreshPlain = decryptAtRest(row.refreshTokenEnc);
  } catch {
    await markReauthRequired(companyId, 'decrypt refresh failed');
    throw new Error('Stored tokens invalid; reconnect Xero');
  }

  let tokens: XeroOAuth.XeroTokenResponse;
  try {
    tokens = await XeroOAuth.refreshAccessToken(refreshPlain);
  } catch (e) {
    const msg = (e as Error).message;
    await markReauthRequired(companyId, msg);
    await logXeroAudit({
      companyId,
      action: 'token_refresh_failed',
      detail: msg,
    });
    throw e;
  }

  const { accessEnc, refreshEnc, expiresAt } = encryptTokenBundle(tokens);
  const refreshExpiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

  const updated = await prisma.xeroConnection.update({
    where: { companyId },
    data: {
      accessTokenEnc: accessEnc,
      refreshTokenEnc: refreshEnc,
      accessTokenExpiresAt: expiresAt,
      refreshTokenExpiresAt: refreshExpiresAt,
      lastRefreshedAt: new Date(),
      scopes: tokens.scope ?? row.scopes,
      status: 'active',
    },
  });

  await logXeroAudit({ companyId, action: 'token_refreshed', detail: 'access token rotated' });

  return { accessToken: tokens.access_token, row: updated };
}

async function markReauthRequired(companyId: string, detail: string): Promise<void> {
  await prisma.xeroConnection.updateMany({
    where: { companyId },
    data: { status: 'reauth_required' as XeroConnectionStatus },
  });
  await logXeroAudit({ companyId, action: 'reauth_required', detail });
}

/** Tenant-isolated GET to Xero Accounting API */
export async function xeroAccountingGet(
  companyId: string,
  path: string,
  query?: Record<string, string>
): Promise<unknown> {
  const { accessToken, row } = await getValidAccessTokenForCompany(companyId);
  const base = 'https://api.xero.com/api.xro/2.0';
  const u = new URL(path.startsWith('http') ? path : `${base}${path.startsWith('/') ? '' : '/'}${path}`);
  if (query) {
    Object.entries(query).forEach(([k, v]) => u.searchParams.set(k, v));
  }
  const res = await fetch(u.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      'Xero-tenant-id': row.xeroTenantId!,
    },
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Xero API ${res.status}: ${t.slice(0, 300)}`);
  }
  return res.json();
}

/** Tenant-isolated POST to Xero Accounting API (JSON body). */
export async function xeroAccountingPost(companyId: string, path: string, body: unknown): Promise<unknown> {
  const { accessToken, row } = await getValidAccessTokenForCompany(companyId);
  const base = 'https://api.xero.com/api.xro/2.0';
  const url = `${base}${path.startsWith('/') ? '' : '/'}${path}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'Xero-tenant-id': row.xeroTenantId!,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Xero API ${res.status}: ${text.slice(0, 800)}`);
  }
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return text;
  }
}
