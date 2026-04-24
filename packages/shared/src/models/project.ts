export type ProjectType = 'regular' | 'callout';

export interface Project {
  id: string;
  name: string;
  company_id: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  /** Geofence radius for attendance (meters). Default 150 if omitted. */
  allowed_radius_meters?: number;
  project_type?: ProjectType;
  category?: string;
  start_date?: string;
  /** Present in API responses: true when start_date is set and not in the future (UTC day). */
  can_be_active?: boolean;
  photo_urls?: string[];
  supervisor_id?: string;
  assigned_staff_id?: string;
  created_by_user_id?: string;
  completed?: boolean;
  completed_at?: string;
  archived?: boolean;
  archived_at?: string;
  created_at: string;
  updated_at: string;
}
