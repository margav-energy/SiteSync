export interface FitToWork {
  id: string;
  user_id: string;
  project_id: string;
  declared_at: string;
  created_at: string;
}

export interface RAMS {
  id: string;
  project_id: string;
  signed_by: string[];
  created_at: string;
  updated_at: string;
}

export interface ToolboxTalk {
  id: string;
  project_id: string;
  attended_by: string[];
  created_at: string;
}

export interface FireRollCall {
  id: string;
  project_id: string;
  conducted_by: string;
  present: string[];
  created_at: string;
}
