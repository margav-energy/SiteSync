import { config } from '../config/apiConfig';

/** Unauthenticated GET for public invitation lookup (no Bearer token). */
export async function publicGetJson<T>(path: string): Promise<T> {
  return publicRequestJson<T>(path);
}

/** Unauthenticated request helper (no Bearer token). */
export async function publicRequestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${config.apiBaseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  const headers = new Headers(init?.headers ?? {});
  if (init?.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const res = await fetch(url, { ...init, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText || 'Request failed');
  }
  return res.json() as Promise<T>;
}
