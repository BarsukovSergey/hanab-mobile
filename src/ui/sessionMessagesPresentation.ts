import {
  sessionMessagesOwnedBy,
  type SessionMessagesState,
  type SessionPrivateMessage,
} from '../store/sessionMessagesSlice';

export type SessionConversationRow = {
  username: string;
  lastMessage: SessionPrivateMessage;
  unread: number;
  hasReconnectGap: boolean;
};

export function sessionConversationRows(
  state: SessionMessagesState,
  authenticatedUsername: string | null | undefined,
): SessionConversationRow[] {
  if (!sessionMessagesOwnedBy(state, authenticatedUsername)) return [];
  return Object.values(state.conversations).flatMap((conversation) => {
    const lastMessage = conversation.messages[conversation.messages.length - 1];
    return lastMessage === undefined ? [] : [{
      username: conversation.username,
      lastMessage,
      unread: conversation.unread,
      hasReconnectGap: conversation.hasReconnectGap,
    }];
  }).sort((left, right) => right.lastMessage.sequence - left.lastMessage.sequence);
}

export function sessionConversation(
  state: SessionMessagesState,
  authenticatedUsername: string | null | undefined,
  username: string,
) {
  if (!sessionMessagesOwnedBy(state, authenticatedUsername)) return null;
  return state.conversations[username.toLowerCase()] ?? null;
}

export function sessionMessageDraft(
  state: SessionMessagesState,
  authenticatedUsername: string | null | undefined,
  username: string,
): string {
  if (!sessionMessagesOwnedBy(state, authenticatedUsername)) return '';
  return state.drafts[username.toLowerCase()] ?? '';
}
