import axiosInstance from './axiosInstance';
import type { Incident } from '../models';

export const incidentsService = {
  async getAll(): Promise<Incident[]> {
    const { data } = await axiosInstance.get<Incident[]>('/incidents');
    return data;
  },

  async create(incident: Partial<Incident>): Promise<Incident> {
    const { data } = await axiosInstance.post<Incident>('/incidents', incident);
    return data;
  },

  async update(id: string, incident: Partial<Incident>): Promise<Incident> {
    const { data } = await axiosInstance.put<Incident>(`/incidents/${id}`, incident);
    return data;
  },
};
