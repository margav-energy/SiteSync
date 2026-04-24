import axiosInstance from './axiosInstance';
import type { Project } from '../models';

/** Create body: project fields plus legacy company resolution. */
export type ProjectCreatePayload = Partial<Project> & {
  created_by_user_id?: string;
  createdByUserId?: string;
};

export const projectsService = {
  async getAll(): Promise<Project[]> {
    const { data } = await axiosInstance.get<Project[]>('/projects');
    return data;
  },

  async getById(id: string): Promise<Project> {
    const { data } = await axiosInstance.get<Project>(`/projects/${id}`);
    return data;
  },

  async create(project: ProjectCreatePayload, opts?: { userId?: string }): Promise<Project> {
    const qs =
      opts?.userId != null && opts.userId !== ''
        ? `?userId=${encodeURIComponent(opts.userId)}`
        : '';
    const body: ProjectCreatePayload = {
      ...project,
      ...(opts?.userId &&
        project.created_by_user_id == null &&
        project.createdByUserId == null && { created_by_user_id: opts.userId }),
    };
    const { data } = await axiosInstance.post<Project>(`/projects${qs}`, body);
    return data;
  },

  async update(id: string, project: Partial<Project>): Promise<Project> {
    const { data } = await axiosInstance.put<Project>(`/projects/${id}`, project);
    return data;
  },

  async delete(id: string): Promise<void> {
    await axiosInstance.delete(`/projects/${id}`);
  },

  async archive(id: string, archived = true): Promise<Project> {
    const { data } = await axiosInstance.put<Project>(`/projects/${id}/archive`, { archived });
    return data;
  },
};
