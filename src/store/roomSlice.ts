import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import type { TableStart } from '../protocol/lobbyProtocol';
import { sessionActions } from './sessionSlice';

export type RoomState =
  | { kind: 'none' }
  | {
      kind: 'awaiting_game_bootstrap';
      tableID: number;
      role: 'spectator';
      tableStartReceived: true;
      bootstrap: 'pending_c5';
    };

export type RoomSliceState = {
  connectionEpoch: number;
  pendingSpectateTableID: number | null;
  room: RoomState;
};

const initialState: RoomSliceState = {
  connectionEpoch: 0,
  pendingSpectateTableID: null,
  room: { kind: 'none' },
};

export const roomSlice = createSlice({
  name: 'room',
  initialState,
  reducers: {
    spectateRequested(
      state,
      action: PayloadAction<{ epoch: number; tableID: number }>,
    ) {
      if (state.connectionEpoch !== action.payload.epoch) return;
      if (state.room.kind !== 'none' || state.pendingSpectateTableID !== null) return;
      state.pendingSpectateTableID = action.payload.tableID;
    },
    tableStartReceived(
      state,
      action: PayloadAction<{ epoch: number; tableStart: TableStart }>,
    ) {
      if (state.connectionEpoch !== action.payload.epoch) return;
      const { tableStart } = action.payload;
      if (tableStart.replay) return;
      if (state.pendingSpectateTableID !== tableStart.tableID) return;
      if (state.room.kind !== 'none') return;

      state.pendingSpectateTableID = null;
      state.room = {
        kind: 'awaiting_game_bootstrap',
        tableID: tableStart.tableID,
        role: 'spectator',
        tableStartReceived: true,
        bootstrap: 'pending_c5',
      };
    },
  },
  extraReducers: (builder) => {
    builder.addCase(sessionActions.connectionStarted, (state, action) => {
      state.connectionEpoch = action.payload.epoch;
      state.pendingSpectateTableID = null;
      state.room = { kind: 'none' };
    });
  },
});

export const roomActions = roomSlice.actions;
