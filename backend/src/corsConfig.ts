import type { CorsOptions } from 'cors';

const DEFAULT_ORIGINS = [
  'http://localhost:8081',
  'http://localhost:8082',
  'http://localhost:8083',
  'http://localhost:19006',
  'http://localhost:3000',
  'http://127.0.0.1:8081',
  'http://127.0.0.1:8082',
];

/**
 * Browsers send the page origin (e.g. Expo web on :8082). In development, allow any localhost port.
 * ALLOWED_ORIGINS is merged with DEFAULT_ORIGINS so a custom list does not drop common Expo ports (8082, etc.).
 */
export function corsOrigin(): CorsOptions['origin'] {
  const fromEnv = process.env.ALLOWED_ORIGINS?.split(',').map((s) => s.trim()).filter(Boolean) ?? [];
  const allowList = [...new Set([...DEFAULT_ORIGINS, ...fromEnv])];
  const isDev = process.env.NODE_ENV !== 'production';

  return (origin, callback) => {
    if (!origin) {
      callback(null, true);
      return;
    }
    if (allowList.includes(origin)) {
      callback(null, true);
      return;
    }
    if (isDev && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error(`Not allowed by CORS: ${origin}`));
  };
}
