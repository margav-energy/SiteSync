import axiosInstance from './axiosInstance';
import type { OnboardingJson, OnboardingRecord } from '../models';

export const onboardingService = {
  async getAll(): Promise<OnboardingRecord[]> {
    const { data } = await axiosInstance.get<OnboardingRecord[]>('/onboarding');
    return data;
  },

  async create(record: Partial<OnboardingRecord>): Promise<OnboardingRecord> {
    const { data } = await axiosInstance.post<OnboardingRecord>('/onboarding', record);
    return data;
  },

  async update(id: string, record: Partial<OnboardingRecord>): Promise<OnboardingRecord> {
    const { data } = await axiosInstance.put<OnboardingRecord>(`/onboarding/${id}`, record);
    return data;
  },

  async loadProgress(userId: string): Promise<OnboardingRecord> {
    const { data } = await axiosInstance.get<OnboardingRecord>(`/onboarding/progress/${userId}`);
    return data;
  },

  async loadNewStarter(userId: string): Promise<{ user_id: string; data: OnboardingJson }> {
    const { data } = await axiosInstance.get<{ user_id: string; data: OnboardingJson }>(
      `/onboarding/new-starter/${userId}`
    );
    return data;
  },

  async saveNewStarter(userId: string, payload: OnboardingJson): Promise<OnboardingRecord> {
    const { data } = await axiosInstance.post<OnboardingRecord>('/onboarding/new-starter', {
      user_id: userId,
      data: payload,
    });
    return data;
  },

  async saveQualifications(userId: string, payload: OnboardingJson): Promise<OnboardingRecord> {
    const { data } = await axiosInstance.post<OnboardingRecord>('/onboarding/qualifications', {
      user_id: userId,
      data: payload,
    });
    return data;
  },

  async savePolicies(userId: string, payload: OnboardingJson): Promise<OnboardingRecord> {
    const { data } = await axiosInstance.post<OnboardingRecord>('/onboarding/policies', {
      user_id: userId,
      data: payload,
    });
    return data;
  },

  async loadCis(userId: string): Promise<{ user_id: string; data: OnboardingJson }> {
    const { data } = await axiosInstance.get<{ user_id: string; data: OnboardingJson }>(
      `/onboarding/cis/${userId}`
    );
    return data;
  },

  async saveCis(userId: string, payload: OnboardingJson): Promise<OnboardingRecord> {
    const { data } = await axiosInstance.post<OnboardingRecord>('/onboarding/cis', {
      user_id: userId,
      data: payload,
    });
    return data;
  },

  /** Admin: send in-app notification to the user to complete onboarding. */
  async remindUser(userId: string): Promise<{ ok: boolean; message: string }> {
    const { data } = await axiosInstance.post<{ ok: boolean; message: string }>(
      `/onboarding/remind/${userId}`
    );
    return data;
  },
};
