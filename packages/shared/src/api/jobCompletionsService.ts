import axiosInstance from './axiosInstance';
import type { JobCompletion } from '../models';

export const jobCompletionsService = {
  async getAll(): Promise<JobCompletion[]> {
    const { data } = await axiosInstance.get<JobCompletion[]>('/job-completions');
    return data;
  },

  async create(completion: Partial<JobCompletion>): Promise<JobCompletion> {
    const { data } = await axiosInstance.post<JobCompletion>('/job-completions', completion);
    return data;
  },

  async update(id: string, completion: Partial<JobCompletion>): Promise<JobCompletion> {
    const { data } = await axiosInstance.put<JobCompletion>(`/job-completions/${id}`, completion);
    return data;
  },

  async approve(id: string): Promise<JobCompletion> {
    const { data } = await axiosInstance.put<JobCompletion>(`/job-completions/${id}/approve`);
    return data;
  },
};
