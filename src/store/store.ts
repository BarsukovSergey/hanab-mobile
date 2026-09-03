import { configureStore } from '@reduxjs/toolkit';

import { lobbySlice, tablesAdapter, usersAdapter } from './lobbySlice';
import { chatSlice } from './chatSlice';
import { roomSlice } from './roomSlice';
import { sessionSlice } from './sessionSlice';
import { terminationSlice } from './terminationSlice';
import { historySlice } from './historySlice';

export function createAppStore() {
  return configureStore({
    reducer: {
      session: sessionSlice.reducer,
      lobby: lobbySlice.reducer,
      room: roomSlice.reducer,
      chat: chatSlice.reducer,
      termination: terminationSlice.reducer,
      history: historySlice.reducer,
    },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware({
      serializableCheck: {
        // Replay snapshots are a large tree of plain serializable game data. Re-checking every
        // historical GameState after every dispatch makes the development invariant middleware
        // dominate dispatch time, while the rest of Redux state/actions remain fully checked.
        ignoredPaths: ['room.room.clientState.replay.states'],
      },
    }),
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
