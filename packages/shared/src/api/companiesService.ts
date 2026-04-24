import axiosInstance from './axiosInstance';
import type { Company, User } from '../models';

export const companiesService = {
  async getAll(): Promise<Company[]> {
    const { data } = await axiosInstance.get<Company[]>('/companies');
    return data;
  },

  async getById(id: string): Promise<Company> {
    const { data } = await axiosInstance.get<Company>(`/companies/${id}`);
    return data;
  },

  async create(company: Partial<Company>): Promise<Company> {
    const { data } = await axiosInstance.post<Company>('/companies', company);
    return data;
  },

  async update(id: string, company: Partial<Company>): Promise<Company> {
    const { data } = await axiosInstance.put<Company>(`/companies/${id}`, company);
    return data;
  },

  async updateStatus(
    id: string,
    status: { is_active?: boolean; is_suspended?: boolean; is_archived?: boolean }
  ): Promise<Company> {
    const { data } = await axiosInstance.patch<Company>(`/companies/${id}/status`, status);
    return data;
  },

  async getAdmins(id: string): Promise<User[]> {
    const { data } = await axiosInstance.get<User[]>(`/companies/${id}/admins`);
    return data;
  },

  async delete(id: string): Promise<void> {
    await axiosInstance.delete(`/companies/${id}`);
  },
};
