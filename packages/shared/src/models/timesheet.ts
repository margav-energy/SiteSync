export interface TimeEntry {
  id: string;
  user_id: string;
  project_id: string;
  sign_in_at: string;
  sign_out_at?: string;
  latitude_in?: number;
  longitude_in?: number;
  sign_in_address?: string;
  arrived_at?: string;
  arrival_latitude?: number;
  arrival_longitude?: number;
  arrival_address?: string;
  travel_minutes?: number;
  travel_miles?: number;
  latitude_out?: number;
  longitude_out?: number;
  sign_out_address?: string;
  accuracy_in?: number;
  accuracy_out?: number;
  distance_from_project_in_m?: number;
  distance_from_project_out_m?: number;
  approved_by_user_id?: string;
  approved_at?: string;
  created_at: string;
  updated_at: string;
}

export interface Timesheet {
  entries: TimeEntry[];
  total_hours?: number;
}
