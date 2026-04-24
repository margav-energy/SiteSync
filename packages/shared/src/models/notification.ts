export type NotificationType = 'info' | 'warning' | 'error' | 'success';

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  body: string;
  type: NotificationType;
  action_route?: string;
  action_params?: Record<string, unknown>;
  read: boolean;
  created_at: string;
}
