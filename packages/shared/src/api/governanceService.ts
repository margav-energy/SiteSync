import axiosInstance from './axiosInstance';
import type {
  ComplianceByCompany,
  GovernanceSummary,
  SevereIncidentOverview,
} from '../models/governance';

export const governanceService = {
  async getSummary(): Promise<GovernanceSummary> {
    const { data } = await axiosInstance.get<GovernanceSummary>('/governance/summary');
    return data;
  },

  async getIncidentsOverview(): Promise<SevereIncidentOverview[]> {
    const { data } = await axiosInstance.get<{ severe_unresolved: SevereIncidentOverview[] }>(
      '/governance/incidents-overview'
    );
    return data.severe_unresolved ?? [];
  },

  async getComplianceOverview(): Promise<ComplianceByCompany[]> {
    const { data } = await axiosInstance.get<{ by_company: ComplianceByCompany[] }>(
      '/governance/compliance-overview'
    );
    return data.by_company ?? [];
  },
};
