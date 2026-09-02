import {
  createEntityAdapter,
  createSlice,
  type PayloadAction,
} from '@reduxjs/toolkit';

import type { LobbyTable, LobbyUser } from '../protocol/lobbyProtocol';
import { sessionActions } from './sessionSlice';

const usersAdapter = createEntityAdapter<LobbyUser, number>({
  selectId: (user) => user.userID,
});

const tablesAdapter = createEntityAdapter<LobbyTable>();

const initialState = {
  users: usersAdapter.getInitialState(),
  tables: tablesAdapter.getInitialState(),
  connectionEpoch: 0,
  userListReceived: false,
  tableListReceived: false,
  notice: null as { kind: 'warning' | 'error'; message: string } | null,
};

export const lobbySlice = createSlice({
  name: 'lobby',
  initialState,
  reducers: {
    userListReceived(state, action: PayloadAction<{ epoch: number; users: LobbyUser[] }>) {
      if (state.connectionEpoch !== action.payload.epoch) return;
      usersAdapter.upsertMany(state.users, action.payload.users);
      state.userListReceived = true;
    },
    userReceived(state, action: PayloadAction<{ epoch: number; user: LobbyUser }>) {
      if (state.connectionEpoch !== action.payload.epoch) return;
      usersAdapter.upsertOne(state.users, action.payload.user);
    },
    userLeft(state, action: PayloadAction<{ epoch: number; userID: number }>) {
      if (state.connectionEpoch !== action.payload.epoch) return;
      usersAdapter.removeOne(state.users, action.payload.userID);
    },
    userInactiveReceived(
      state,
      action: PayloadAction<{ epoch: number; userID: number; inactive: boolean }>,
    ) {
      if (
        state.connectionEpoch !== action.payload.epoch
        || state.users.entities[action.payload.userID] === undefined
      ) return;
      usersAdapter.updateOne(state.users, {
        id: action.payload.userID,
        changes: { inactive: action.payload.inactive },
      });
    },
    tableListReceived(state, action: PayloadAction<{ epoch: number; tables: LobbyTable[] }>) {
      if (state.connectionEpoch !== action.payload.epoch) return;
      tablesAdapter.upsertMany(state.tables, action.payload.tables);
      state.tableListReceived = true;
    },
    tableReceived(state, action: PayloadAction<{ epoch: number; table: LobbyTable }>) {
      if (state.connectionEpoch !== action.payload.epoch) return;
      tablesAdapter.upsertOne(state.tables, action.payload.table);
    },
    tableGone(state, action: PayloadAction<{ epoch: number; tableID: number }>) {
      if (state.connectionEpoch !== action.payload.epoch) return;
      tablesAdapter.removeOne(state.tables, action.payload.tableID);
    },
    noticeReceived(
      state,
      action: PayloadAction<{
        epoch: number;
        notice: { kind: 'warning' | 'error'; message: string };
      }>,
    ) {
      if (state.connectionEpoch !== action.payload.epoch) return;
      state.notice = action.payload.notice;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(sessionActions.connectionStarted, (state, action) => {
      state.connectionEpoch = action.payload.epoch;
      usersAdapter.removeAll(state.users);
      tablesAdapter.removeAll(state.tables);
      state.userListReceived = false;
      state.tableListReceived = false;
      state.notice = null;
    });
    builder.addCase(sessionActions.signedOut, () => initialState);
  },
});

export const lobbyActions = lobbySlice.actions;
export { tablesAdapter, usersAdapter };
