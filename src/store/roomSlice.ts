import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import type {
  PregameGame,
  TableJoined,
  TableLeft,
  TableStart,
} from '../protocol/lobbyProtocol';
import { sessionActions } from './sessionSlice';

export type RoomState =
  | { kind: 'none' }
  | {
      kind: 'pregame';
      tableID: number;
      role: 'player';
      data: PregameGame;
    }
  | {
      kind: 'awaiting_game_bootstrap';
      tableID: number;
      role: 'player' | 'spectator';
      tableStartReceived: true;
      bootstrap: 'pending_c5';
    };

type PendingJoin = {
  tableID: number;
  joinedConfirmed: boolean;
  stagedGame: PregameGame | null;
};

export type RoomSliceState = {
  connectionEpoch: number;
  pendingSpectateTableID: number | null;
  pendingJoin: PendingJoin | null;
  pendingLeaveTableID: number | null;
  room: RoomState;
};

const initialState: RoomSliceState = {
  connectionEpoch: 0,
  pendingSpectateTableID: null,
  pendingJoin: null,
  pendingLeaveTableID: null,
  room: { kind: 'none' },
};

function clearC4BState(state: RoomSliceState): void {
  state.pendingJoin = null;
  state.pendingLeaveTableID = null;
}

export const roomSlice = createSlice({
  name: 'room',
  initialState,
  reducers: {
    spectateRequested(
      state,
      action: PayloadAction<{ epoch: number; tableID: number }>,
    ) {
      if (state.connectionEpoch !== action.payload.epoch) return;
      if (
        state.room.kind !== 'none'
        || state.pendingSpectateTableID !== null
        || state.pendingJoin !== null
      ) return;
      state.pendingSpectateTableID = action.payload.tableID;
    },
    joinRequested(
      state,
      action: PayloadAction<{ epoch: number; tableID: number }>,
    ) {
      if (state.connectionEpoch !== action.payload.epoch) return;
      if (
        state.room.kind !== 'none'
        || state.pendingSpectateTableID !== null
        || state.pendingJoin !== null
      ) return;
      state.pendingJoin = {
        tableID: action.payload.tableID,
        joinedConfirmed: false,
        stagedGame: null,
      };
    },
    joinedReceived(
      state,
      action: PayloadAction<{ epoch: number; joined: TableJoined }>,
    ) {
      if (state.connectionEpoch !== action.payload.epoch) return;
      if (state.room.kind === 'awaiting_game_bootstrap') return;
      const pending = state.pendingJoin;
      if (
        state.room.kind !== 'none'
        || pending === null
        || pending.tableID !== action.payload.joined.tableID
      ) return;

      pending.joinedConfirmed = true;
      if (pending.stagedGame !== null) {
        state.room = {
          kind: 'pregame',
          tableID: pending.tableID,
          role: 'player',
          data: pending.stagedGame,
        };
        state.pendingJoin = null;
      }
    },
    gameReceived(
      state,
      action: PayloadAction<{ epoch: number; game: PregameGame }>,
    ) {
      if (state.connectionEpoch !== action.payload.epoch) return;
      if (state.room.kind === 'awaiting_game_bootstrap') return;
      const { game } = action.payload;

      if (state.room.kind === 'pregame') {
        if (state.room.tableID === game.tableID) state.room.data = game;
        return;
      }

      const pending = state.pendingJoin;
      if (pending === null || pending.tableID !== game.tableID) return;
      if (pending.joinedConfirmed) {
        state.room = {
          kind: 'pregame',
          tableID: pending.tableID,
          role: 'player',
          data: game,
        };
        state.pendingJoin = null;
      } else {
        // At most one same-epoch join may be pending, so this staging cannot
        // be attributed to any other table or connection.
        pending.stagedGame = game;
      }
    },
    leaveRequested(
      state,
      action: PayloadAction<{ epoch: number; tableID: number }>,
    ) {
      if (state.connectionEpoch !== action.payload.epoch) return;
      if (
        state.room.kind !== 'pregame'
        || state.room.tableID !== action.payload.tableID
        || state.pendingLeaveTableID !== null
      ) return;
      state.pendingLeaveTableID = action.payload.tableID;
    },
    leftReceived(
      state,
      action: PayloadAction<{ epoch: number; left: TableLeft }>,
    ) {
      if (state.connectionEpoch !== action.payload.epoch) return;
      if (state.room.kind === 'awaiting_game_bootstrap') return;
      const tableID = action.payload.left.TableID;
      if (
        state.room.kind !== 'pregame'
        || state.room.tableID !== tableID
        || state.pendingLeaveTableID !== tableID
      ) return;

      state.pendingLeaveTableID = null;
      state.room = { kind: 'none' };
    },
    tableStartReceived(
      state,
      action: PayloadAction<{ epoch: number; tableStart: TableStart }>,
    ) {
      if (state.connectionEpoch !== action.payload.epoch) return;
      const { tableStart } = action.payload;
      if (tableStart.replay || state.room.kind === 'awaiting_game_bootstrap') return;

      let role: 'player' | 'spectator' | null = null;
      if (
        state.room.kind === 'none'
        && state.pendingSpectateTableID === tableStart.tableID
      ) {
        role = 'spectator';
      } else if (
        state.room.kind === 'none'
        && state.pendingJoin?.tableID === tableStart.tableID
      ) {
        role = 'player';
      } else if (
        state.room.kind === 'pregame'
        && state.room.tableID === tableStart.tableID
      ) {
        role = 'player';
      }
      if (role === null) return;

      state.pendingSpectateTableID = null;
      clearC4BState(state);
      state.room = {
        kind: 'awaiting_game_bootstrap',
        tableID: tableStart.tableID,
        role,
        tableStartReceived: true,
        bootstrap: 'pending_c5',
      };
    },
  },
  extraReducers: (builder) => {
    builder.addCase(sessionActions.connectionStarted, (state, action) => {
      state.connectionEpoch = action.payload.epoch;
      state.pendingSpectateTableID = null;
      clearC4BState(state);
      state.room = { kind: 'none' };
    });
  },
});

export const roomActions = roomSlice.actions;
