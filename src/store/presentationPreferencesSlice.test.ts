import { expect, test } from '@jest/globals';
import { createAppStore } from './store';
import { sessionActions } from './sessionSlice';
import { presentationPreferencesActions } from './presentationPreferencesSlice';

test('defaults to Bottom, changes locally, and survives account/session reset', () => {
  const store = createAppStore();
  expect(store.getState().presentationPreferences.ownHandPosition).toBe('bottom');
  store.dispatch(presentationPreferencesActions.ownHandPositionChanged('top'));
  expect(store.getState().presentationPreferences.ownHandPosition).toBe('top');
  store.dispatch(sessionActions.signedOut());
  expect(store.getState().presentationPreferences.ownHandPosition).toBe('top');
  store.dispatch(presentationPreferencesActions.ownHandPositionChanged('bottom'));
  expect(store.getState().presentationPreferences.ownHandPosition).toBe('bottom');
  expect(createAppStore().getState().presentationPreferences.ownHandPosition).toBe('bottom');
});
