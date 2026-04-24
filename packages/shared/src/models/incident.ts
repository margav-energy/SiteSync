export interface Incident {
  id: string;
  user_id: string;
  project_id?: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  photo_url?: string;
  status: string;
  resolution_report?: string;
  resolution_photo_url?: string;
  resolved_by_user_id?: string;
  resolved_at?: string;
  created_at: string;
  updated_at: string;
}
