import type { UserRole } from './user';

export type OnboardingJson = Record<string, unknown>;

export interface OnboardingRecord {
  id: string;
  user_id: string;
  status: string;
  completed_at?: string;
  /** ISO timestamp; set when a reminder notification was last sent. */
  last_reminder_at?: string;
  /** Present on GET /onboarding for admin list when server includes user. */
  user_email?: string;
  user_name?: string;
  user_role?: UserRole;
  new_starter?: OnboardingJson;
  qualifications?: OnboardingJson;
  policies?: OnboardingJson;
  cis?: OnboardingJson;
  created_at: string;
  updated_at: string;
}

export interface CompanyInvitationPreview {
  id: string;
  email: string;
  role: UserRole;
  company_id: string;
  expires_at: string;
}
