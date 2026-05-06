import axiosInstance from './axiosInstance';
import { publicGetJson, publicRequestJson } from './publicApi';
import type { CompanyInvitationPreview } from '../models';

export const companyInvitationsService = {
  async getByToken(token: string): Promise<CompanyInvitationPreview> {
    const t = encodeURIComponent(token.trim());
    return publicGetJson<CompanyInvitationPreview>(`/company-invitations/token/${t}`);
  },

  async markUsed(id: string): Promise<{ id: string; used_at?: string }> {
    const { data } = await axiosInstance.put<{ id: string; used_at?: string }>(
      `/company-invitations/${id}/use`
    );
    return data;
  },

  async create(payload: {
    email: string;
    role?: string;
    company_id?: string;
    expires_in_days?: number;
  }): Promise<{ id: string; token: string; email: string; role: string; company_id: string; expires_at: string; email_sent?: boolean }> {
    const { data } = await axiosInstance.post('/company-invitations', payload);
    return data;
  },
  async requestCode(email: string): Promise<{
    ok: boolean;
    message: string;
    email_sent?: boolean;
    reason?: 'sent' | 'not_found' | 'delivery_unavailable';
  }> {
    return publicRequestJson<{
      ok: boolean;
      message: string;
      email_sent?: boolean;
      reason?: 'sent' | 'not_found' | 'delivery_unavailable';
    }>('/company-invitations/request-code', {
      method: 'POST',
      body: JSON.stringify({ email: email.trim().toLowerCase() }),
    });
  },
};
