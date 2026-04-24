import axiosInstance from './axiosInstance';
import type { TimeEntry } from '../models';

/** Extra fields accepted by POST/PUT /timesheets for attendance auditing. */
export type TimeEntryWritePayload = Partial<TimeEntry> & {
  action_type?: 'sign_in' | 'sign_out';
  timestamp?: string;
  accuracy_in?: number;
  accuracy_out?: number;
  /** Optional client-reported distance (m); server recomputes for validation. */
  distance_from_project_m?: number;
};

export const timesheetsService = {
  async getAll(): Promise<TimeEntry[]> {
    const { data } = await axiosInstance.get<TimeEntry[]>('/timesheets');
    return data;
  },

  async getByUserId(userId: string): Promise<TimeEntry[]> {
    const { data } = await axiosInstance.get<TimeEntry[]>(`/timesheets/user/${userId}`);
    return data;
  },

  async getById(id: string): Promise<TimeEntry> {
    const { data } = await axiosInstance.get<TimeEntry>(`/timesheets/${id}`);
    return data;
  },

  async create(entry: TimeEntryWritePayload): Promise<TimeEntry> {
    const { data } = await axiosInstance.post<TimeEntry>('/timesheets', entry);
    return data;
  },

  async update(id: string, entry: TimeEntryWritePayload): Promise<TimeEntry> {
    const { data } = await axiosInstance.put<TimeEntry>(`/timesheets/${id}`, entry);
    return data;
  },

  async approve(id: string): Promise<TimeEntry> {
    const { data } = await axiosInstance.put<TimeEntry>(`/timesheets/${id}/approve`);
    return data;
  },

  async markArrived(
    id: string,
    payload: { arrival_latitude: number; arrival_longitude: number; arrived_at?: string }
  ): Promise<TimeEntry> {
    const { data } = await axiosInstance.put<TimeEntry>(`/timesheets/${id}/arrive`, payload);
    return data;
  },

  async delete(id: string): Promise<void> {
    await axiosInstance.delete(`/timesheets/${id}`);
  },
};
