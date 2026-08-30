import { configureStore } from '@reduxjs/toolkit';

import { lobbySlice, tablesAdapter, usersAdapter } from './lobbySlice';
import { sessionSlice } from './sessionSlice';

export function createAppStore() {
  return configureStore({
    reducer: {
      session: sessionSlice.reducer,
      lobby: lobbySlice.reducer,
    },
  });
}

export const store = createAppStore();

export type AppStore = ReturnType<typeof createAppStore>;
export type RootState = ReturnType<AppStore['getState']>;
export type AppDispatch = AppStore['dispatch'];

export const userSelectors = usersAdapter.getSelectors(
  (state: RootState) => state.lobby.users,
);
export const tableSelectors = tablesAdapter.getSelectors(
  (state: RootState) => state.lobby.tables,
);

export const selectAuthReady = (state: RootState): boolean =>
  state.session.phase === 'ready';

export const selectLobbyHydrated = (state: RootState): boolean =>
  selectAuthReady(state)
  && state.lobby.connectionEpoch === state.session.connectionEpoch
  && state.lobby.userListReceived
  && state.lobby.tableListReceived;
