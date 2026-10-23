import React from 'react';
import { Alert } from 'react-native';
import { Provider } from 'react-redux';
import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';
import { bootstrap, FakeSession, welcome } from '../testUtils/appRuntimeHarness';
import { createAppStore } from '../../store/store';
import { LobbyRuntime } from '../../runtime/LobbyRuntime';
import { TerminationRuntime } from '../../runtime/terminationRuntime';
import { ActionButton, HanabThemeProvider } from '../designSystem';
import { TerminationControls } from './TerminationControls';

const { act, create } = require('react-test-renderer');
jest.mock('react-redux', () => require('../../../node_modules/react-redux/dist/cjs/react-redux.development.cjs'));
jest.mock('../../runtime/application', () => ({
  get terminationRuntime() { return mockTermination; },
}));
let mockTermination: TerminationRuntime;
let tree: ReturnType<typeof create> | undefined;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  jest.useFakeTimers();
});
afterEach(() => {
  if (tree) act(() => tree.unmount());
  tree = undefined;
  jest.restoreAllMocks();
  jest.useRealTimers();
});

// Captures a JS callback from the real control, not Android Alert persistence.
test.each(['valid', 'same-table load', 'reconnect', 'different room'] as const)(
  'Alert confirmation callback is bound to its original identity: %s', async (transition) => {
    const session = new FakeSession();
    const store = createAppStore();
    const runtime = new LobbyRuntime(session, store);
    mockTermination = new TerminationRuntime(runtime, store);
    await runtime.connect();
    const first = session.sockets[0];
    welcome(first);
    bootstrap(first);
    act(() => { tree = create(<Provider store={store}><HanabThemeProvider><TerminationControls /></HanabThemeProvider></Provider>); });
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const button = tree.root.findAllByType(ActionButton)
      .find((node: { props: { title: string } }) => node.props.title === 'Terminate game');
    act(() => button.props.onPress());
    const confirm = alert.mock.calls[0]?.[2]?.find((entry) => entry.text === 'Terminate')?.onPress;
    expect(confirm).toBeDefined();
    let current = first;
    if (transition === 'same-table load') {
      act(() => bootstrap(first));
    } else if (transition === 'reconnect' || transition === 'different room') {
      act(() => runtime.disconnect());
      await act(async () => { await runtime.connect(); });
      current = session.sockets[1];
      const tableID = transition === 'different room' ? 456 : 123;
      act(() => { welcome(current, tableID); bootstrap(current, tableID); });
    }
    expect(store.getState().room.room.kind).toBe('live_game');
    const before = [...current.sent];
    act(() => confirm?.());
    expect(current.sent.slice(before.length)).toEqual(transition === 'valid'
      ? ['tableTerminate {"tableID":123}'] : []);
    // A fresh prompt in the new current room remains functional.
    if (transition !== 'valid') {
      act(() => tree.root.findAllByType(ActionButton)
        .find((node: { props: { title: string } }) => node.props.title === 'Terminate game').props.onPress());
      act(() => alert.mock.calls.at(-1)?.[2]?.find((entry) => entry.text === 'Terminate')?.onPress?.());
      const room = store.getState().room.room;
      expect(room.kind === 'live_game' && current.sent.at(-1)).toBe(`tableTerminate {"tableID":${room.kind === 'live_game' ? room.tableID : 0}}`);
    }
    act(() => runtime.disconnect());
  },
);
