import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import { sessionActions } from './sessionSlice';

export type TerminationVote = {
  connectionEpoch: number;
  tableID: number;
  gameLoadEpoch: number;
  value: boolean;
};

export type TerminationState = {
  vote: TerminationVote | null;
};

const initialState: TerminationState = {
  vote: null,
};

export const terminationSlice = createSlice({
  name: 'termination',
  initialState,
  reducers: {
    voteChanged(state, action: PayloadAction<TerminationVote>) {
      state.vote = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(sessionActions.connectionStarted, () => initialState);
    builder.addCase(sessionActions.signedOut, () => initialState);
  },
});

export const terminationActions = terminationSlice.actions;
