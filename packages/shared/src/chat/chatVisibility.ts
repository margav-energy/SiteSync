/** Tracks which conversation screen is focused (for suppressing duplicate notifications). */
let activeConversationId: string | null = null;

export function setActiveChatConversationId(id: string | null): void {
  activeConversationId = id;
}

export function getActiveChatConversationId(): string | null {
  return activeConversationId;
}
