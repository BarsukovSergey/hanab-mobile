import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import { chatMarkupToPlainText } from '../protocol/chatText';
import { chatActions } from './chatSlice';
import { sessionActions } from './sessionSlice';

export type SessionPrivateMessage = {
  sequence: number;
  direction: 'incoming' | 'outgoing';
  who: string;
  recipient: string;
  msg: string;
  datetime: string;
};

export type SessionConversation = {
  username: string;
  messages: SessionPrivateMessage[];
  unread: number;
  hasReconnectGap: boolean;
};

export type SessionMessagesState = {
  connectionEpoch: number;
  ownerUsername: string | null;
  ownerConfirmed: boolean;
  nextSequence: number;
  conversations: Record<string, SessionConversation>;
  drafts: Record<string, string>;
};

const MAX_MESSAGES_PER_CONVERSATION = 1000;
const initialState: SessionMessagesState = {
  connectionEpoch: 0,
  ownerUsername: null,
  ownerConfirmed: false,
  nextSequence: 1,
  conversations: {},
  drafts: {},
};

export function sessionMessagesOwnedBy(
  state: SessionMessagesState,
  authenticatedUsername: string | null | undefined,
): boolean {
  return state.ownerConfirmed && !!authenticatedUsername && state.ownerUsername !== null
    && state.ownerUsername.toLowerCase() === authenticatedUsername.toLowerCase();
}

// Include account identity in local edits so stale surfaces cannot edit another account.
type ConversationPayload = { authenticatedUsername: string; username: string };

export const sessionMessagesSlice = createSlice({
  name: 'sessionMessages',
  initialState,
  reducers: {
    draftChanged(state, action: PayloadAction<ConversationPayload & { draft: string }>) {
      if (!sessionMessagesOwnedBy(state, action.payload.authenticatedUsername)) return;
      state.drafts[action.payload.username.toLowerCase()] = action.payload.draft;
    },
    draftSubmissionFinished(
      state,
      action: PayloadAction<ConversationPayload & { succeeded: boolean }>,
    ) {
      if (!sessionMessagesOwnedBy(state, action.payload.authenticatedUsername)) return;
      if (action.payload.succeeded) delete state.drafts[action.payload.username.toLowerCase()];
    },
    conversationRead(state, action: PayloadAction<ConversationPayload>) {
      if (!sessionMessagesOwnedBy(state, action.payload.authenticatedUsername)) return;
      const conversation = state.conversations[action.payload.username.toLowerCase()];
      if (conversation) conversation.unread = 0;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(sessionActions.connectionStarted, (state, action) => {
      state.connectionEpoch = action.payload.epoch;
      state.ownerConfirmed = false;
      for (const conversation of Object.values(state.conversations)) {
        if (conversation.messages.length > 0) conversation.hasReconnectGap = true;
      }
    });
    builder.addCase(sessionActions.welcomeReceived, (state, action) => {
      if (state.connectionEpoch !== action.payload.epoch) return;
      const username = action.payload.welcome.username;
      if (state.ownerUsername?.toLowerCase() !== username.toLowerCase()) {
        state.conversations = {};
        state.drafts = {};
        state.nextSequence = initialState.nextSequence;
      }
      state.ownerUsername = username;
      state.ownerConfirmed = true;
    });
    builder.addCase(sessionActions.signedOut, () => initialState);
    // Only live observation contributes; room history and local send results never do.
    builder.addCase(chatActions.messageReceived, (state, action) => {
      const { epoch, authenticatedUsername, message } = action.payload;
      if (state.connectionEpoch !== epoch
        || !sessionMessagesOwnedBy(state, authenticatedUsername)
        || message.recipient.length === 0) return;
      const self = state.ownerUsername!.toLowerCase();
      const outgoing = message.who.toLowerCase() === self;
      if (!outgoing && message.recipient.toLowerCase() !== self) return;
      const username = outgoing ? message.recipient : message.who;
      if (username.length === 0) return;
      const key = username.toLowerCase();
      const conversation = state.conversations[key] ?? {
        username, messages: [], unread: 0, hasReconnectGap: false,
      };
      conversation.username = username;
      conversation.messages.push({
        sequence: state.nextSequence++,
        direction: outgoing ? 'outgoing' : 'incoming',
        who: message.who,
        recipient: message.recipient,
        msg: chatMarkupToPlainText(message.msg),
        datetime: message.datetime,
      });
      if (conversation.messages.length > MAX_MESSAGES_PER_CONVERSATION) {
        conversation.messages.splice(0, conversation.messages.length - MAX_MESSAGES_PER_CONVERSATION);
      }
      if (!outgoing) conversation.unread += 1;
      state.conversations[key] = conversation;
    });
  },
});

export const sessionMessagesActions = sessionMessagesSlice.actions;
