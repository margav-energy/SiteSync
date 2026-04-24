import axiosInstance from './axiosInstance';
import { pushService } from './pushService';
import type { LoginRequest, LoginResponse, User } from '../models';
import {
  setStoredToken,
  setStoredUser,
  clearAuth,
  setStoredActiveProjectId,
  setRequiresSupervisorProjectPick,
} from '../utils/storage';

export interface RegisterInvitationPayload {
  token: string;
  first_name: string;
  last_name: string;
  password: string;
  email?: string;
  photo_url?: string;
  /** `strict` = use invitation role (staff manual register); `invite_link` = admin-app mapping (admin→admin, else supervisor). */
  role_mapping?: 'strict' | 'invite_link';
}

export const authService = {
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    const { data } = await axiosInstance.post<LoginResponse>('/auth/login', credentials);
    await setStoredToken(data.token);
    await setStoredUser(JSON.stringify(data.user));
    // Force fresh project selection after each login (used by supervisor dashboard scoping).
    await setStoredActiveProjectId(null);
    await setRequiresSupervisorProjectPick(data.user.role === 'supervisor');
    return data;
  },

  async register(payload: Partial<User> & { password: string }): Promise<LoginResponse> {
    const { data } = await axiosInstance.post<LoginResponse>('/auth/register', payload);
    await setStoredToken(data.token);
    await setStoredUser(JSON.stringify(data.user));
    return data;
  },

  async registerInvitation(payload: RegisterInvitationPayload): Promise<LoginResponse> {
    const { data } = await axiosInstance.post<LoginResponse>('/auth/register-invitation', payload);
    await setStoredToken(data.token);
    await setStoredUser(JSON.stringify(data.user));
    return data;
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<User> {
    const { data } = await axiosInstance.post<{ user: User }>('/auth/change-password', {
      current_password: currentPassword,
      new_password: newPassword,
    });
    await setStoredUser(JSON.stringify(data.user));
    return data.user;
  },

  async logout(): Promise<void> {
    await pushService.unregister();
    await clearAuth();
  },

  async requestPasswordReset(email: string): Promise<void> {
    await axiosInstance.post('/password-reset/request', { email });
  },

  async resetPassword(token: string, password: string): Promise<void> {
    await axiosInstance.post('/password-reset/reset', { token, password });
  },
};
