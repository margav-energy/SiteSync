import axios, { AxiosError } from 'axios';
import { config } from '../config/apiConfig';
import { clearAuth, getStoredToken, getStoredActiveCompanyId } from '../utils/storage';

const axiosInstance = axios.create({
  baseURL: config.apiBaseUrl,
  headers: {
    'Content-Type': 'application/json',
  },
});

let handlingUnauthorized = false;

function isNgrokFreeHost(url: string): boolean {
  return /ngrok-free\.app|ngrok-free\.dev|ngrok\.io|ngrok\.app/i.test(url);
}

axiosInstance.interceptors.request.use(async (reqConfig) => {
  const token = await getStoredToken();
  if (token) {
    reqConfig.headers.Authorization = `Bearer ${token}`;
  }
  const companyId = await getStoredActiveCompanyId();
  if (companyId) {
    reqConfig.headers['X-Company-Id'] = companyId;
  }
  const base = reqConfig.baseURL ?? config.apiBaseUrl;
  if (typeof base === 'string' && isNgrokFreeHost(base)) {
    reqConfig.headers['ngrok-skip-browser-warning'] = 'true';
  }
  return reqConfig;
});

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    if (error.response?.status === 401) {
      if (!handlingUnauthorized) {
        handlingUnauthorized = true;
        await clearAuth();
        // Web: force a clean app state so navigation returns to auth.
        const webGlobal = globalThis as typeof globalThis & {
          location?: { reload?: () => void };
        };
        if (typeof webGlobal.location?.reload === 'function') {
          try {
            webGlobal.location.reload();
          } catch {
            // no-op
          }
        }
      }
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;
