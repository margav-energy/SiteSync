import axiosInstance from './axiosInstance';
import type { Notification } from '../models';

export const notificationsService = {
  async getAll(): Promise<Notification[]> {
    const { data } = await axiosInstance.get<Notification[]>('/notifications');
    return data;
  },

  async markRead(id: string): Promise<void> {
    await axiosInstance.put(`/notifications/${id}/read`);
  },

  async delete(id: string): Promise<void> {
    await axiosInstance.delete(`/notifications/${id}`);
  },
};
