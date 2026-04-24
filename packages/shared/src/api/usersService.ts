import axiosInstance from './axiosInstance';
import type { User } from '../models';

export const usersService = {
  async getAll(params?: {
    query?: string;
    role?: User['role'];
    company_id?: string;
    active_only?: boolean;
  }): Promise<User[]> {
    const { data } = await axiosInstance.get<User[]>('/users', { params });
    return data;
  },

  async getAdmins(companyId?: string): Promise<(User & { companies?: { id: string; name: string }[] })[]> {
    const { data } = await axiosInstance.get<(User & { companies?: { id: string; name: string }[] })[]>(
      '/users/admins',
      { params: companyId ? { company_id: companyId } : undefined }
    );
    return data;
  },

  async getById(id: string): Promise<User> {
    const { data } = await axiosInstance.get<User>(`/users/${id}`);
    return data;
  },

  async getByEmail(email: string): Promise<User> {
    const { data } = await axiosInstance.get<User>(`/users/email/${encodeURIComponent(email)}`);
    return data;
  },

  async create(user: Partial<User> & { password: string }): Promise<User> {
    const { data } = await axiosInstance.post<User>('/users', user);
    return data;
  },

  async update(id: string, user: Partial<User>): Promise<User> {
    const { data } = await axiosInstance.put<User>(`/users/${id}`, user);
    return data;
  },

  async delete(id: string): Promise<void> {
    await axiosInstance.delete(`/users/${id}`);
  },
};
