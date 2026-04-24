export interface JobCompletion {
  id: string;
  user_id: string;
  project_id: string;
  description: string;
  photo_urls: string[];
  status: 'pending' | 'supervisor_approved' | 'approved';
  created_at: string;
  updated_at: string;
}
