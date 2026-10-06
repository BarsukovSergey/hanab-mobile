import { configureStore } from '@reduxjs/toolkit';

import { lobbySlice, tablesAdapter, usersAdapter } from './lobbySlice';
import { chatSlice } from './chatSlice';
import { roomSlice } from './roomSlice';
import { sessionSlice } from './sessionSlice';
import { sessionMessagesSlice } from './sessionMessagesSlice';
import { terminationSlice } from './terminationSlice';
import { historySlice } from './historySlice';
import { presentationPreferencesSlice } from './presentationPreferencesSlice';

export function createAppStore() {
  return configureStore({
    reducer: {
      session: sessionSlice.reducer,
      lobby: lobbySlice.reducer,
      room: roomSlice.reducer,
      chat: chatSlice.reducer,
      sessionMessages: sessionMessagesSlice.reducer,
      termination: terminationSlice.reducer,
      history: historySlice.reducer,
      presentationPreferences: presentationPreferencesSlice.reducer,
    },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware({
      serializableCheck: {
        // The headless game client is a large tree of plain serializable upstream-derived state.
        // Re-scanning that entire tree after every game dispatch dominates development runtime
        // without adding useful coverage; the surrounding Redux state and every action remain
        // checked for serializability.
        ignoredPaths: ['room.room.clientState'],
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
