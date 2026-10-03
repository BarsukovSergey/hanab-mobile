import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export type OwnHandPosition = 'top' | 'bottom';

export const presentationPreferencesSlice = createSlice({
  name: 'presentationPreferences',
  initialState: { ownHandPosition: 'bottom' as OwnHandPosition },
  reducers: {
    ownHandPositionChanged(state, action: PayloadAction<OwnHandPosition>) {
      state.ownHandPosition = action.payload;
    },
  },
});

export const presentationPreferencesActions = presentationPreferencesSlice.actions;
