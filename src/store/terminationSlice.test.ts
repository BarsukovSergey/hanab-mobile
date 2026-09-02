import { describe, expect, test } from '@jest/globals';

import { sessionActions } from './sessionSlice';
import { terminationActions } from './terminationSlice';
import { createAppStore } from './store';

describe('C14-B2 termination state', () => {
  test('stores authoritative self vote with room identity and clears it on a new connection', () => {
    const store = createAppStore();
    store.dispatch(sessionActions.connectionStarted({ epoch: 1 }));
    store.dispatch(terminationActions.voteChanged({
      connectionEpoch: 1,
      tableID: 123,
      gameLoadEpoch: 7,
      value: true,
    }));
    expect(store.getState().termination.vote).toEqual({
      connectionEpoch: 1,
      tableID: 123,
      gameLoadEpoch: 7,
      value: true,
    });

    store.dispatch(sessionActions.connectionStarted({ epoch: 2 }));
    expect(store.getState().termination.vote).toBeNull();
  });
});
