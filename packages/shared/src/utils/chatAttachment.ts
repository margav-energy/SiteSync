import { config } from '../config/apiConfig';

/** Origin of the API (e.g. http://192.168.1.5:3001) — used to fix localhost file URLs on devices. */
function getApiOrigin(): string {
  try {
    const raw = config.apiBaseUrl.replace(/\/$/, '');
    const withApi = raw.endsWith('/api') ? raw : `${raw}/api`;
    return new URL(withApi).origin;
  } catch {
    return '';
  }
}

/**
 * Open/download URLs stored as http://localhost:... from the upload response break on phones
 * (localhost is the device). Rewrites those (and relative /files/... paths) to EXPO_PUBLIC_API_URL origin.
 */
export function resolvePublicFileUrl(url: string): string {
  if (!url || url.startsWith('file:')) return url;
  const origin = getApiOrigin();
  if (!origin) return url;

  if (url.startsWith('/')) {
    return `${origin}${url}`;
  }

  try {
    const u = new URL(url);
    if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') {
      return `${origin}${u.pathname}${u.search}${u.hash}`;
    }
  } catch {
    return url;
  }
  return url;
}

/** Infer whether an attachment URL is likely an image (for preview). */
export function isImageAttachmentUrl(url: string): boolean {
  const path = url.split('?')[0] ?? url;
  return /\.(jpg|jpeg|png|gif|webp|bmp)(\?|#|$)/i.test(path);
}

export function chatLastMessagePreview(content: string, attachmentUrl?: string): string {
  const text = content?.trim() ?? '';
  if (attachmentUrl) {
    if (isImageAttachmentUrl(attachmentUrl)) {
      return text ? `📷 ${text}` : '📷 Photo';
    }
    return text ? `📎 ${text}` : '📎 File';
  }
  return text || 'No messages yet';
}
