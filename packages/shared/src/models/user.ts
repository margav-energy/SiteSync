export type UserRole = 'staff' | 'supervisor' | 'admin' | 'superadmin';

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  company_id: string;
  photo_url?: string;
  /** When true, client should show mandatory password change before main app. */
  must_change_password?: boolean;
  is_active: boolean;
  /** ISO timestamp; set by backend on successful login when supported. */
  last_login_at?: string;
  created_at: string;
  updated_at: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: User;
  token: string;
}
