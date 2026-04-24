import axiosInstance from './axiosInstance';
import type { Conversation, Message, ToolboxDiscussion } from '../models';

export const chatService = {
  async getUnreadCount(): Promise<number> {
    const { data } = await axiosInstance.get<{ count: number }>('/chat/unread-count');
    return data.count ?? 0;
  },

  async getConversations(): Promise<Conversation[]> {
    const { data } = await axiosInstance.get<Conversation[]>('/chat/conversations');
    return data;
  },

  async searchConversations(query: string): Promise<string[]> {
    const { data } = await axiosInstance.get<{ conversation_ids: string[] }>('/chat/search', {
      params: { query },
    });
    return data.conversation_ids ?? [];
  },

  async createConversation(participants: string[], projectId?: string): Promise<Conversation> {
    const { data } = await axiosInstance.post<Conversation>('/chat/conversations', {
      participants,
      project_id: projectId,
    });
    return data;
  },

  async getMessages(conversationId: string): Promise<Message[]> {
    const { data } = await axiosInstance.get<Message[]>(
      `/chat/conversations/${conversationId}/messages`
    );
    return data;
  },

  async sendMessage(conversationId: string, content: string, attachmentUrl?: string): Promise<Message> {
    const { data } = await axiosInstance.post<Message>('/chat/messages', {
      conversation_id: conversationId,
      content: content ?? '',
      attachment_url: attachmentUrl,
    });
    return data;
  },

  async markMessageRead(messageId: string): Promise<void> {
    await axiosInstance.put(`/chat/messages/${messageId}/read`);
  },

  async editMessage(messageId: string, content: string): Promise<Message> {
    const { data } = await axiosInstance.put<Message>(`/chat/messages/${messageId}`, { content });
    return data;
  },

  async deleteMessage(messageId: string): Promise<void> {
    await axiosInstance.delete(`/chat/messages/${messageId}`);
  },

  async archiveConversation(conversationId: string, archive = true): Promise<Conversation> {
    const { data } = await axiosInstance.put<Conversation>(`/chat/conversations/${conversationId}/archive`, {
      archive,
    });
    return data;
  },

  async deleteConversation(conversationId: string): Promise<void> {
    await axiosInstance.delete(`/chat/conversations/${conversationId}`);
  },

  async getToolboxDiscussion(): Promise<ToolboxDiscussion> {
    const { data } = await axiosInstance.get<ToolboxDiscussion>('/chat/toolbox');
    return data;
  },

  async postToolboxMessage(content: string, attachmentUrl?: string): Promise<Message> {
    const { data } = await axiosInstance.post<Message>('/chat/toolbox/messages', {
      content,
      attachment_url: attachmentUrl,
    });
    return data;
  },

  async archiveToolboxDiscussion(archive = true): Promise<void> {
    await axiosInstance.put('/chat/toolbox/archive', { archive });
  },
};
