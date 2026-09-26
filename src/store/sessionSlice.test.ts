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
      welcome: welcome({ colorblindMode: true, styleNumbers: false, realLifeMode: true }),
    }));

    expect(store.getState().session.realLifeMode).toBe(true);

    store.dispatch(sessionActions.connectionStarted({ epoch: 2 }));
    expect(store.getState().session.realLifeMode).toBe(false);
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
    expect(store.getState().session.realLifeMode).toBe(false);
    expect(store.getState().session.cardPresentationSettings).toEqual({
      colorblindMode: false,
      styleNumbers: false,
    });
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
