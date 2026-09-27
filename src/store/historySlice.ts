import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import type { GameHistory, GameHistoryItem } from '../protocol/gameProtocol';
import type { GameHistoryOtherScores } from '../protocol/lobbyProtocol';
import { sessionActions } from './sessionSlice';

export type PendingHistoryRequest = {
  connectionEpoch: number;
  offset: number;
  amount: number;
};

export type PendingReplayCreate = {
  connectionEpoch: number;
  source: 'id' | 'json';
  visibility: 'solo' | 'shared';
  databaseID?: number;
} & ({ source: 'id'; databaseID: number } | { source: 'json'; databaseID?: never });

export type PendingOtherScores = {
  connectionEpoch: number;
  sourceDatabaseID: number;
  seed: string;
  friends: boolean;
};

export type HistoryState = {
  connectionEpoch: number;
  totalGames: number;
  items: GameHistoryItem[];
  friendItems: GameHistoryItem[];
  taggedItems: GameHistoryItem[];
  taggedLoaded: boolean;
  taggedPending: boolean;
  taggedError: string | null;
  tagSearchPending: boolean;
  tagSearchQuery: string;
  tagSearchItems: GameHistoryItem[] | null;
  tagSearchActive: boolean;
  tagSearchSequence: number;
  tagSearchRequestId: number | null;
  tagSearchError: string | null;
  initialPageReceived: boolean;
  friendInitialPageReceived: boolean;
  pendingRequest: PendingHistoryRequest | null;
  friendPendingRequest: PendingHistoryRequest | null;
  pendingReplayCreate: PendingReplayCreate | null;
  pendingOtherScores: PendingOtherScores | null;
  otherScores: GameHistoryOtherScores | null;
  error: string | null;
  hasMore: boolean;
  friendHasMore: boolean;
};

const initialState: HistoryState = {
  connectionEpoch: 0,
  totalGames: 0,
  items: [],
  friendItems: [],
  taggedItems: [], taggedLoaded: false, taggedPending: false, taggedError: null,
  tagSearchItems: null, tagSearchActive: false, tagSearchSequence: 0,
  tagSearchRequestId: null, tagSearchPending: false, tagSearchQuery: '', tagSearchError: null,
  initialPageReceived: false,
  friendInitialPageReceived: false,
  pendingRequest: null,
  friendPendingRequest: null,
  pendingReplayCreate: null,
  pendingOtherScores: null,
  otherScores: null,
  error: null,
  hasMore: false,
  friendHasMore: false,
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
    taggedRequested(state, action: PayloadAction<{ connectionEpoch: number }>) {
      if (state.connectionEpoch !== action.payload.connectionEpoch || state.taggedLoaded || state.taggedPending) return;
      state.taggedPending = true; state.taggedError = null;
    },
    taggedReceived(state, action: PayloadAction<{ connectionEpoch: number; history: GameHistory }>) {
      if (state.connectionEpoch !== action.payload.connectionEpoch || !state.taggedPending) return;
      state.taggedItems = action.payload.history; state.taggedLoaded = true; state.taggedPending = false; state.taggedError = null;
    },
    tagSearchRequested(state, action: PayloadAction<{ connectionEpoch: number; tag: string }>) {
      if (state.connectionEpoch !== action.payload.connectionEpoch || state.tagSearchPending || action.payload.tag.trim() === '') return;
      state.tagSearchSequence += 1;
      state.tagSearchRequestId = state.tagSearchSequence;
      state.tagSearchActive = true;
      state.tagSearchQuery = action.payload.tag;
      state.tagSearchItems = null;
      state.tagSearchPending = true;
      state.tagSearchError = null;
    },
    tagSearchReceived(state, action: PayloadAction<{ connectionEpoch: number; requestId: number; tag: string; history: GameHistory }>) {
      if (state.connectionEpoch !== action.payload.connectionEpoch || !state.tagSearchPending
        || state.tagSearchRequestId !== action.payload.requestId || state.tagSearchQuery !== action.payload.tag) return;
      state.tagSearchItems = action.payload.history; state.tagSearchPending = false; state.tagSearchError = null;
    },
    tagSearchCleared(state) {
      state.tagSearchItems = null; state.tagSearchPending = false; state.tagSearchActive = false;
      state.tagSearchQuery = ''; state.tagSearchRequestId = null; state.tagSearchError = null;
    },
    tagFailed(state, action: PayloadAction<
      | { connectionEpoch: number; message: string; request: 'tagged' }
      | { connectionEpoch: number; message: string; request: 'search'; requestId: number; tag: string }
    >) {
      if (state.connectionEpoch !== action.payload.connectionEpoch) return;
      if (action.payload.request === 'tagged') {
        if (!state.taggedPending) return;
        state.taggedPending = false;
        state.taggedError = action.payload.message;
        return;
      }
      if (!state.tagSearchPending || state.tagSearchRequestId !== action.payload.requestId
        || state.tagSearchQuery !== action.payload.tag) return;
      state.tagSearchPending = false;
      state.tagSearchError = action.payload.message;
    },
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
    friendPageRequested(state, action: PayloadAction<PendingHistoryRequest>) {
      if (
        state.connectionEpoch !== action.payload.connectionEpoch
        || state.friendPendingRequest !== null
        || action.payload.amount !== 10
        || (state.friendInitialPageReceived
          ? !state.friendHasMore || action.payload.offset !== state.friendItems.length
          : action.payload.offset !== 0)
      ) return;
      state.friendPendingRequest = action.payload;
      state.error = null;
    },
    friendPageReceived(
      state,
      action: PayloadAction<{ connectionEpoch: number; history: GameHistory }>,
    ) {
      if (state.connectionEpoch !== action.payload.connectionEpoch) return;
      const rawLength = action.payload.history.length;
      if (!state.friendInitialPageReceived) {
        state.friendItems = uniqueItems(action.payload.history);
        state.friendInitialPageReceived = true;
        state.friendPendingRequest = null;
        state.friendHasMore = rawLength >= 10;
        state.error = null;
        return;
      }
      const pending = state.friendPendingRequest;
      if (pending === null || pending.connectionEpoch !== action.payload.connectionEpoch) return;
      // An explicit offset-zero request can race the automatic initial page.
      if (pending.offset === 0) {
        state.friendPendingRequest = null;
        return;
      }
      const seen = new Set(state.friendItems.map((item) => item.id));
      for (const item of action.payload.history) {
        if (!seen.has(item.id)) {
          seen.add(item.id);
          state.friendItems.push(item);
        }
      }
      state.friendPendingRequest = null;
      state.friendHasMore = rawLength >= pending.amount;
      state.error = null;
    },
    replayCreateRequested(state, action: PayloadAction<PendingReplayCreate>) {
      if (
        state.connectionEpoch !== action.payload.connectionEpoch
        || state.pendingReplayCreate !== null
        || (action.payload.source === 'id' && ![...state.items, ...state.friendItems, ...state.taggedItems,
          ...(state.tagSearchItems ?? []), ...(state.otherScores?.games ?? [])]
          .some((item) => item.id === action.payload.databaseID))
      ) return;
      state.pendingReplayCreate = action.payload;
      state.error = null;
    },
    replayCreateAccepted(state, action: PayloadAction<PendingReplayCreate>) {
      const pending = state.pendingReplayCreate;
      if (
        pending?.connectionEpoch === action.payload.connectionEpoch
        && pending.source === action.payload.source
        && pending.visibility === action.payload.visibility
        && pending.databaseID === action.payload.databaseID
      ) state.pendingReplayCreate = null;
    },
    otherScoresRequested(state, action: PayloadAction<PendingOtherScores>) {
      if (state.connectionEpoch !== action.payload.connectionEpoch || state.pendingOtherScores !== null) return;
      const source = (action.payload.friends ? state.friendItems : state.items)
        .find((item) => item.id === action.payload.sourceDatabaseID);
      if (source?.seed !== action.payload.seed || source.numGamesOnThisSeed <= 1) return;
      state.pendingOtherScores = action.payload;
      state.otherScores = null;
      state.error = null;
    },
    otherScoresReceived(state, action: PayloadAction<{ connectionEpoch: number; result: GameHistoryOtherScores }>) {
      const pending = state.pendingOtherScores;
      if (state.connectionEpoch !== action.payload.connectionEpoch
        || pending?.connectionEpoch !== action.payload.connectionEpoch
        || pending.seed !== action.payload.result.seed
        || pending.friends !== action.payload.result.friends) return;
      state.otherScores = action.payload.result;
      state.pendingOtherScores = null;
      state.error = null;
    },
    otherScoresDismissed(state) {
      state.pendingOtherScores = null;
      state.otherScores = null;
    },
    operationFailed(
      state,
      action: PayloadAction<{ connectionEpoch: number; message: string }>,
    ) {
      if (state.connectionEpoch !== action.payload.connectionEpoch) return;
      state.pendingRequest = null;
      state.friendPendingRequest = null;
      state.pendingReplayCreate = null;
      state.pendingOtherScores = null;
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
      state.friendPendingRequest = null;
      state.pendingReplayCreate = null;
      state.pendingOtherScores = null;
      state.taggedPending = false;
      state.tagSearchPending = false;
    });
    builder.addCase(sessionActions.connectionClosed, (state, action) => {
      if (state.connectionEpoch !== action.payload.epoch) return;
      state.pendingRequest = null;
      state.friendPendingRequest = null;
      state.pendingReplayCreate = null;
      state.pendingOtherScores = null;
      state.taggedPending = false;
      state.tagSearchPending = false;
    });
    builder.addCase(sessionActions.signedOut, () => initialState);
  },
});

export const historyActions = historySlice.actions;
