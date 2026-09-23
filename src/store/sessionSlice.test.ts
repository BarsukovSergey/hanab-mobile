import { describe, expect, test } from '@jest/globals';

import type { Welcome } from '../protocol/lobbyProtocol';
import { createAppStore } from './store';
import { sessionActions } from './sessionSlice';

function welcome(settings?: Welcome['settings']): Welcome {
  return {
    userID: 1,
    username: 'Ada',
    totalGames: 0,
    playingAtTables: [],
    ...(settings === undefined ? {} : { settings }),
  };
}

describe('session card presentation settings', () => {
  test('defaults to the standard presentation and updates one local setting', () => {
    const store = createAppStore();
    expect(store.getState().session.cardPresentationSettings).toEqual({
      colorblindMode: false,
      styleNumbers: false,
    });

    store.dispatch(sessionActions.cardPresentationSettingUpdated({
      name: 'styleNumbers',
      enabled: true,
    }));
    expect(store.getState().session.cardPresentationSettings).toEqual({
      colorblindMode: false,
      styleNumbers: true,
    });
  });

  test('preserves last-known settings during reconnect and replaces them on welcome', () => {
    const store = createAppStore();
    store.dispatch(sessionActions.connectionStarted({ epoch: 1 }));
    store.dispatch(sessionActions.welcomeReceived({
      epoch: 1,
      welcome: welcome({ colorblindMode: true, styleNumbers: false }),
    }));

    store.dispatch(sessionActions.connectionStarted({ epoch: 2 }));
    expect(store.getState().session.cardPresentationSettings).toEqual({
      colorblindMode: true,
      styleNumbers: false,
    });

    store.dispatch(sessionActions.welcomeReceived({
      epoch: 2,
      welcome: welcome({ colorblindMode: false, styleNumbers: true }),
    }));
    expect(store.getState().session.cardPresentationSettings).toEqual({
      colorblindMode: false,
      styleNumbers: true,
    });
  });

  test('an absent settings object safely restores welcome defaults', () => {
    const store = createAppStore();
    store.dispatch(sessionActions.cardPresentationSettingUpdated({
      name: 'colorblindMode',
      enabled: true,
    }));
    store.dispatch(sessionActions.connectionStarted({ epoch: 1 }));
    store.dispatch(sessionActions.welcomeReceived({ epoch: 1, welcome: welcome() }));
    expect(store.getState().session.cardPresentationSettings).toEqual({
      colorblindMode: false,
      styleNumbers: false,
    });
  });
});
