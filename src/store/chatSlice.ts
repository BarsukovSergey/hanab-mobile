import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import { chatMarkupToPlainText } from '../protocol/chatText';
import type { ChatMessage } from '../protocol/lobbyProtocol';
import { sessionActions } from './sessionSlice';

export type ReadableChatMessage = Omit<ChatMessage, 'msg' | 'room'> & {
  msg: string;
  rawMsg: string;
  room: string;
  localType?: 'info' | 'error';
};

export type ChatState = {
  connectionEpoch: number;
  lastPM: string | null;
  messagesByRoom: Record<string, ReadableChatMessage[]>;
  unreadByRoom: Record<string, number>;
};

const MAX_MESSAGES_PER_ROOM = 1000;

const initialState: ChatState = {
  connectionEpoch: 0,
  lastPM: null,
  messagesByRoom: {},
  unreadByRoom: {},
};

function isSupportedRoom(room: string | undefined): room is string {
  return room === 'lobby' || (room !== undefined && /^table\d+$/.test(room));
}

function readable(message: ChatMessage, defaultRoom?: string): ReadableChatMessage | null {
  const isPrivateMessage = message.recipient.length > 0
    && (message.room === '' || message.room === undefined);
  const room = isPrivateMessage ? defaultRoom : message.room;
  if (!isSupportedRoom(room)) return null;
  return {
    ...message,
    room,
    rawMsg: message.msg,
    msg: chatMarkupToPlainText(message.msg),
  };
}

function cap(messages: ReadableChatMessage[]): void {
  if (messages.length > MAX_MESSAGES_PER_ROOM) {
    messages.splice(0, messages.length - MAX_MESSAGES_PER_ROOM);
  }
}

export const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    roomRead(state, action: PayloadAction<{ room: string }>) {
      delete state.unreadByRoom[action.payload.room];
    },
    localMessageAdded(
      state,
      action: PayloadAction<{
        epoch: number;
        room: string;
        msg: string;
        type: 'info' | 'error';
        datetime: string;
      }>,
    ) {
      if (state.connectionEpoch !== action.payload.epoch) return;
      const message = readable({
        msg: action.payload.msg,
        who: 'Hanab Mobile',
        discord: false,
        server: true,
        datetime: action.payload.datetime,
        room: action.payload.room,
        recipient: '',
      });
      if (message === null) return;
      message.localType = action.payload.type;
      const messages = state.messagesByRoom[message.room] ?? [];
      messages.push(message);
      cap(messages);
      state.messagesByRoom[message.room] = messages;
    },
    messageReceived(
      state,
      action: PayloadAction<{
        epoch: number;
        defaultRoom: string;
        authenticatedUsername?: string;
        message: ChatMessage;
      }>,
    ) {
      if (state.connectionEpoch !== action.payload.epoch) return;
      const message = readable(action.payload.message, action.payload.defaultRoom);
      if (message === null) return;
      if (
        message.recipient.length > 0
        && message.who.length > 0
        && action.payload.authenticatedUsername !== undefined
        && message.recipient.toLocaleLowerCase()
          === action.payload.authenticatedUsername.toLocaleLowerCase()
      ) {
        state.lastPM = message.who;
      }
      const messages = state.messagesByRoom[message.room] ?? [];
      messages.push(message);
      cap(messages);
      state.messagesByRoom[message.room] = messages;
      const isOwnMessage = action.payload.authenticatedUsername !== undefined
        && message.who.toLocaleLowerCase()
          === action.payload.authenticatedUsername.toLocaleLowerCase();
      if (!isOwnMessage) {
        state.unreadByRoom[message.room] = (state.unreadByRoom[message.room] ?? 0) + 1;
      }
    },
    historyReceived(
      state,
      action: PayloadAction<{
        epoch: number;
        defaultRoom: string;
        messages: readonly ChatMessage[];
      }>,
    ) {
      if (state.connectionEpoch !== action.payload.epoch) return;
      const grouped: Record<string, ReadableChatMessage[]> = {};
      for (const raw of action.payload.messages) {
        const message = readable(raw, action.payload.defaultRoom);
        if (message === null) continue;
        (grouped[message.room] ??= []).push(message);
      }
      if (isSupportedRoom(action.payload.defaultRoom)) {
        state.messagesByRoom[action.payload.defaultRoom] = [];
      }
      for (const [room, messages] of Object.entries(grouped)) {
        cap(messages);
        state.messagesByRoom[room] = messages;
      }
    },
  },
  extraReducers: (builder) => {
    builder.addCase(sessionActions.connectionStarted, (state, action) => {
      state.connectionEpoch = action.payload.epoch;
      state.lastPM = null;
      state.messagesByRoom = {};
      state.unreadByRoom = {};
    });
    builder.addCase(sessionActions.signedOut, () => initialState);
  },
});

export const chatActions = chatSlice.actions;
