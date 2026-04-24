import { config } from '../config/apiConfig';

/** Unauthenticated GET for public invitation lookup (no Bearer token). */
export async function publicGetJson<T>(path: string): Promise<T> {
  const url = `${config.apiBaseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText || 'Request failed');
  }
  return res.json() as Promise<T>;
}
