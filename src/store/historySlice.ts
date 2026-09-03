import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import type { GameHistory, GameHistoryItem } from '../protocol/gameProtocol';
import { sessionActions } from './sessionSlice';

export type PendingHistoryRequest = {
  connectionEpoch: number;
  offset: number;
  amount: number;
};

export type PendingReplayCreate = {
  connectionEpoch: number;
  databaseID: number;
};

export type HistoryState = {
  connectionEpoch: number;
  totalGames: number;
  items: GameHistoryItem[];
  initialPageReceived: boolean;
  pendingRequest: PendingHistoryRequest | null;
  pendingReplayCreate: PendingReplayCreate | null;
  error: string | null;
  hasMore: boolean;
};

const initialState: HistoryState = {
  connectionEpoch: 0,
  totalGames: 0,
  items: [],
  initialPageReceived: false,
  pendingRequest: null,
  pendingReplayCreate: null,
  error: null,
  hasMore: false,
};

function uniqueItems(items: readonly GameHistoryItem[]): GameHistoryItem[] {
  const seen = new Set<number>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

export const historySlice = createSlice({
  name: 'history',
  initialState,
  reducers: {
    pageRequested(state, action: PayloadAction<PendingHistoryRequest>) {
      if (
        state.connectionEpoch !== action.payload.connectionEpoch
        || !state.initialPageReceived
        || !state.hasMore
        || state.pendingRequest !== null
        || action.payload.offset !== state.items.length
      ) return;
      state.pendingRequest = action.payload;
      state.error = null;
    },
    pageReceived(
      state,
      action: PayloadAction<{ connectionEpoch: number; history: GameHistory }>,
    ) {
      if (state.connectionEpoch !== action.payload.connectionEpoch) return;
      const rawLength = action.payload.history.length;
      if (!state.initialPageReceived) {
        state.items = uniqueItems(action.payload.history);
        state.initialPageReceived = true;
        state.hasMore = rawLength >= 10 && state.items.length < state.totalGames;
        state.error = null;
        return;
      }
      const pending = state.pendingRequest;
      if (pending === null || pending.connectionEpoch !== action.payload.connectionEpoch) return;
      const seen = new Set(state.items.map((item) => item.id));
      for (const item of action.payload.history) {
        if (!seen.has(item.id)) {
          seen.add(item.id);
          state.items.push(item);
        }
      }
      state.pendingRequest = null;
      state.hasMore = rawLength >= pending.amount && state.items.length < state.totalGames;
      state.error = null;
    },
    replayCreateRequested(state, action: PayloadAction<PendingReplayCreate>) {
      if (
        state.connectionEpoch !== action.payload.connectionEpoch
        || state.pendingReplayCreate !== null
        || !state.items.some((item) => item.id === action.payload.databaseID)
      ) return;
      state.pendingReplayCreate = action.payload;
      state.error = null;
    },
    replayCreateAccepted(state, action: PayloadAction<PendingReplayCreate>) {
      const pending = state.pendingReplayCreate;
      if (
        pending?.connectionEpoch === action.payload.connectionEpoch
        && pending.databaseID === action.payload.databaseID
      ) state.pendingReplayCreate = null;
    },
    operationFailed(
      state,
      action: PayloadAction<{ connectionEpoch: number; message: string }>,
    ) {
      if (state.connectionEpoch !== action.payload.connectionEpoch) return;
      state.pendingRequest = null;
      state.pendingReplayCreate = null;
      state.error = action.payload.message;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(sessionActions.connectionStarted, (_state, action) => ({
      ...initialState,
      connectionEpoch: action.payload.epoch,
    }));
    builder.addCase(sessionActions.welcomeReceived, (state, action) => {
      if (state.connectionEpoch !== action.payload.epoch) return;
      state.totalGames = action.payload.welcome.totalGames;
      state.hasMore = state.initialPageReceived
        && state.items.length < state.totalGames
        && state.items.length >= 10;
    });
    builder.addCase(sessionActions.connectionFailed, (state, action) => {
      if (state.connectionEpoch !== action.payload.epoch) return;
      state.pendingRequest = null;
      state.pendingReplayCreate = null;
    });
    builder.addCase(sessionActions.connectionClosed, (state, action) => {
      if (state.connectionEpoch !== action.payload.epoch) return;
      state.pendingRequest = null;
      state.pendingReplayCreate = null;
    });
    builder.addCase(sessionActions.signedOut, () => initialState);
  },
});

export const historyActions = historySlice.actions;
