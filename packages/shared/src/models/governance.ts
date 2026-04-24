export interface GovernanceSummary {
  companies: number;
  active_users: number;
  projects: number;
  incidents: number;
  pending_approvals: number;
}

export interface SevereIncidentOverview {
  id: string;
  description: string;
  severity: string;
  status: string;
  company_id: string;
  company_name: string;
  created_at: string;
}

export interface ComplianceByCompany {
  company_id: string;
  company_name: string;
  pending: number;
  completed: number;
}
