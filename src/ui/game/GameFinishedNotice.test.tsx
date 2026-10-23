import React from 'react';
import { AppState, Modal, ScrollView, type AppStateStatus } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';
import type { RoomState } from '../../store/roomSlice';
import { ActionButton } from '../designSystem';
import { GameFinishedNotice } from './GameFinishedNotice';

const { act, create } = require('react-test-renderer');
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('../designSystem', () => ({
  useHanabTheme: () => ({ theme: { colors: {} } }),
  ActionButton: (props: { title: string }) => require('react').createElement(require('react-native').Text, {}, props.title),
}));
type Props = React.ComponentProps<typeof GameFinishedNotice>;
let tree: ReturnType<typeof create>;
let props: Props;
let appListeners: Array<(state: AppStateStatus) => void>;
const room = (finished = false) => ({ kind: 'live_game', tableID: 123, gameLoadEpoch: 1, sharedReplay: finished,
  gameHistory: finished ? { endCondition: 4 } : null,
  clientState: { finished, ongoingGame: { score: 22, stats: { maxScore: 25 } }, replay: {
    shared: finished ? {} : null, databaseID: finished ? 77 : null, actions: [],
  } } }) as unknown as Extract<RoomState, { kind: 'live_game' }>;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  Object.defineProperty(AppState, 'currentState', { configurable: true, value: 'active' });
  tree = undefined; appListeners = [];
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => {
    appListeners.push(listener); return { remove: jest.fn() };
  });
  props = { room: room(), connectionEpoch: 1, ready: true, presentationVisible: true };
});
afterEach(() => { if (tree) act(() => tree.unmount()); jest.restoreAllMocks(); });
function render(patch: Partial<Props> = {}) {
  props = { ...props, ...patch };
  act(() => { if (tree) tree.update(<GameFinishedNotice {...props} />); else tree = create(<GameFinishedNotice {...props} />); });
}
function popups() { return tree.root.findAllByProps({ testID: 'game-finished-popup' }); }

test('finish popup has final score/reason, sticky Continue, Back dismissal and no repeated popup', () => {
  render(); expect(popups()).toHaveLength(0);
  render({ room: room(true) });
  expect(popups().length).toBeGreaterThan(0);
  expect(tree.root.findAllByType(SafeAreaView)[0].props.edges).toEqual(['top', 'right', 'bottom', 'left']);
  render({ room: { ...room(true) } }); // responsive host rerender retains this lifetime
  expect(tree.root.findAllByType(Modal)).toHaveLength(1);
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Final score 22 out of 25' }).length).toBeGreaterThan(0);
  expect(tree.root.findByType(ScrollView).findAllByType(ActionButton)).toHaveLength(0);
  act(() => tree.root.findByType(Modal).props.onRequestClose());
  expect(popups()).toHaveLength(0);
  render({ room: room(true) }); expect(popups()).toHaveLength(0);
  render({ presentationVisible: false }); render({ presentationVisible: true });
  expect(popups()).toHaveLength(0);
  render({ room: { ...room(), gameLoadEpoch: 2 } });
  render({ room: { ...room(true), gameLoadEpoch: 2 } });
  expect(popups().length).toBeGreaterThan(0);
  act(() => tree.root.findByType(ActionButton).props.onPress());
  expect(popups()).toHaveLength(0);
});

test('first-load/reconnect finished and background/hidden transitions remain silent on return', () => {
  render({ room: room(true) }); expect(popups()).toHaveLength(0);
  render({ connectionEpoch: 2, room: room() });
  act(() => appListeners.forEach((listener) => listener('background')));
  render({ room: room(true) });
  act(() => appListeners.forEach((listener) => listener('active')));
  expect(popups()).toHaveLength(0);
  render({ connectionEpoch: 3, room: room(), presentationVisible: false });
  render({ room: room(true) }); render({ presentationVisible: true });
  expect(popups()).toHaveLength(0);
});
