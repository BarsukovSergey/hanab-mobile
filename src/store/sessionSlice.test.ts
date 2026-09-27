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
    expect(store.getState().session.realLifeMode).toBe(false);
    expect(store.getState().session.hyphenatedConventions).toBe(false);
    expect(store.getState().session.showTimerInUntimed).toBe(false);
    expect(store.getState().session.cardPresentationSettings).toEqual({
      colorblindMode: false,
      styleNumbers: false,
      reverseHands: false,
    });

    store.dispatch(sessionActions.cardPresentationSettingUpdated({
      name: 'styleNumbers',
      enabled: true,
    }));
    expect(store.getState().session.cardPresentationSettings).toEqual({
      colorblindMode: false,
      styleNumbers: true,
      reverseHands: false,
    });
  });

  test('preserves last-known settings during reconnect and replaces them on welcome', () => {
    const store = createAppStore();
    store.dispatch(sessionActions.connectionStarted({ epoch: 1 }));
    store.dispatch(sessionActions.welcomeReceived({
      epoch: 1,
      welcome: welcome({ colorblindMode: true, styleNumbers: false, reverseHands: true, realLifeMode: true, hyphenatedConventions: true, showTimerInUntimed: true }),
    }));

    expect(store.getState().session.realLifeMode).toBe(true);
    expect(store.getState().session.hyphenatedConventions).toBe(true);
    expect(store.getState().session.showTimerInUntimed).toBe(true);

    store.dispatch(sessionActions.connectionStarted({ epoch: 2 }));
    expect(store.getState().session.realLifeMode).toBe(false);
    expect(store.getState().session.hyphenatedConventions).toBe(false);
    expect(store.getState().session.showTimerInUntimed).toBe(false);
    expect(store.getState().session.cardPresentationSettings).toEqual({
      colorblindMode: true,
      styleNumbers: false,
      reverseHands: true,
    });

    store.dispatch(sessionActions.welcomeReceived({
      epoch: 2,
      welcome: welcome({ colorblindMode: false, styleNumbers: true, reverseHands: false }),
    }));
    expect(store.getState().session.cardPresentationSettings).toEqual({
      colorblindMode: false,
      styleNumbers: true,
      reverseHands: false,
    });
    expect(store.getState().session.realLifeMode).toBe(false);
    expect(store.getState().session.hyphenatedConventions).toBe(false);
  });

  test('an absent settings object safely restores welcome defaults', () => {
    const store = createAppStore();
    store.dispatch(sessionActions.cardPresentationSettingUpdated({
      name: 'colorblindMode',
      enabled: true,
    }));
    store.dispatch(sessionActions.connectionStarted({ epoch: 1 }));
    store.dispatch(sessionActions.welcomeReceived({ epoch: 1, welcome: welcome() }));
    expect(store.getState().session.realLifeMode).toBe(false);
    expect(store.getState().session.hyphenatedConventions).toBe(false);
    expect(store.getState().session.cardPresentationSettings).toEqual({
      colorblindMode: false,
      styleNumbers: false,
      reverseHands: false,
    });
  });
});

describe('session Create table preferences', () => {
  test('uses safe defaults, preserves reconnect values, replaces from welcome, and resets on sign-out', () => {
    const store = createAppStore();
    expect(store.getState().session.createTablePreferences).toMatchObject({ variant: 'No Variant', timed: false, maxPlayers: 5 });
    store.dispatch(sessionActions.connectionStarted({ epoch: 1 }));
    store.dispatch(sessionActions.welcomeReceived({ epoch: 1, welcome: welcome({
      createTableVariant: 'unsupported', createTableTimed: true, createTableTimeBaseMinutes: 1.5,
      createTableTimePerTurnSeconds: 30, createTableMaxPlayers: 9,
    }) }));
    expect(store.getState().session.createTablePreferences).toMatchObject({
      variant: 'No Variant', timed: true, timeBaseMinutes: 1.5, timePerTurnSeconds: 30, maxPlayers: 5,
    });
    store.dispatch(sessionActions.connectionStarted({ epoch: 2 }));
    expect(store.getState().session.createTablePreferences.timeBaseMinutes).toBe(1.5);
    store.dispatch(sessionActions.welcomeReceived({ epoch: 2, welcome: welcome({ createTableVariant: '6 Suits', createTableMaxPlayers: 4 }) }));
    expect(store.getState().session.createTablePreferences).toMatchObject({ variant: '6 Suits', timed: false, maxPlayers: 4 });
    store.dispatch(sessionActions.signedOut());
    expect(store.getState().session.createTablePreferences).toMatchObject({ variant: 'No Variant', maxPlayers: 5 });
  });
});

describe('session random table name', () => {
  test('uses welcome, replaces with name events, and clears across epochs and sign-out', () => {
    const store = createAppStore();
    store.dispatch(sessionActions.connectionStarted({ epoch: 1 }));
    store.dispatch(sessionActions.welcomeReceived({ epoch: 1, welcome: {
      ...welcome(), randomTableName: 'First Name',
    } }));
    expect(store.getState().session.randomTableName).toBe('First Name');
    store.dispatch(sessionActions.randomTableNameReceived({ epoch: 1, name: 'Second Name' }));
    expect(store.getState().session.randomTableName).toBe('Second Name');
    store.dispatch(sessionActions.connectionStarted({ epoch: 2 }));
    expect(store.getState().session.randomTableName).toBeNull();
    store.dispatch(sessionActions.randomTableNameReceived({ epoch: 1, name: 'Stale Name' }));
    expect(store.getState().session.randomTableName).toBeNull();
    store.dispatch(sessionActions.welcomeReceived({ epoch: 2, welcome: welcome() }));
    expect(store.getState().session.randomTableName).toBeNull();
    store.dispatch(sessionActions.randomTableNameReceived({ epoch: 2, name: 'Current Name' }));
    store.dispatch(sessionActions.signedOut());
    expect(store.getState().session.randomTableName).toBeNull();
  });
});

describe('authoritative mute state', () => {
  test('defaults false, follows welcome, and resets on a new connection epoch', () => {
    const store = createAppStore();
    expect(store.getState().session.muted).toBe(false);
    store.dispatch(sessionActions.connectionStarted({ epoch: 1 }));
    store.dispatch(sessionActions.welcomeReceived({ epoch: 1, welcome: { ...welcome(), muted: true } }));
    expect(store.getState().session.muted).toBe(true);

    store.dispatch(sessionActions.connectionStarted({ epoch: 2 }));
    expect(store.getState().session.muted).toBe(false);
    store.dispatch(sessionActions.welcomeReceived({ epoch: 2, welcome: welcome() }));
    expect(store.getState().session.muted).toBe(false);
  });
});

describe('authoritative server status', () => {
  test('welcome initializes it and connection epochs clear and guard live updates', () => {
    const store = createAppStore();
    store.dispatch(sessionActions.connectionStarted({ epoch: 1 }));
    store.dispatch(sessionActions.welcomeReceived({ epoch: 1, welcome: {
      ...welcome(), shuttingDown: true, datetimeShutdownInit: 'shutdown-at', maintenanceMode: true,
    } }));
    expect(store.getState().session.serverStatus).toEqual({
      shuttingDown: true, datetimeShutdownInit: 'shutdown-at', maintenanceMode: true,
    });
    store.dispatch(sessionActions.shutdownReceived({
      epoch: 1, shuttingDown: false, datetimeShutdownInit: 'ignored-when-cancelled',
    }));
    expect(store.getState().session.serverStatus).toEqual({
      shuttingDown: false, datetimeShutdownInit: null, maintenanceMode: true,
    });
    store.dispatch(sessionActions.maintenanceReceived({ epoch: 1, maintenanceMode: false }));
    expect(store.getState().session.serverStatus.maintenanceMode).toBe(false);

    store.dispatch(sessionActions.connectionStarted({ epoch: 2 }));
    expect(store.getState().session.serverStatus).toEqual({
      shuttingDown: false, datetimeShutdownInit: null, maintenanceMode: false,
    });
    store.dispatch(sessionActions.shutdownReceived({
      epoch: 1, shuttingDown: true, datetimeShutdownInit: 'stale',
    }));
    store.dispatch(sessionActions.maintenanceReceived({ epoch: 1, maintenanceMode: true }));
    expect(store.getState().session.serverStatus).toEqual({
      shuttingDown: false, datetimeShutdownInit: null, maintenanceMode: false,
    });
    store.dispatch(sessionActions.signedOut());
    expect(store.getState().session.serverStatus).toEqual({
      shuttingDown: false, datetimeShutdownInit: null, maintenanceMode: false,
    });
  });
});
