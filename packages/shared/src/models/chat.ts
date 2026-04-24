export interface Conversation {
  id: string;
  participants: string[];
  project_id?: string;
  type?: 'direct' | 'toolbox';
  created_at: string;
  updated_at: string;
  last_message?: Message;
  /** Messages from others not yet read by the current user (from GET /conversations). */
  unread_count?: number;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  attachment_url?: string;
  read_by: string[];
  created_at: string;
}

export interface ToolboxDiscussion {
  conversation_id: string;
  archived: boolean;
  messages: Message[];
}
