/**
 * API base URL for your own backend (greenfield — no default to any legacy service).
 * Override with EXPO_PUBLIC_API_URL / EXPO_PUBLIC_SOCKET_URL in each app's .env
 */
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001/api';
const SOCKET_URL = process.env.EXPO_PUBLIC_SOCKET_URL || 'http://localhost:3001';

export const config = {
  apiBaseUrl: API_URL,
  socketUrl: SOCKET_URL,
};

export default config;
