import React from 'react';
import { AppState, ScrollView } from 'react-native';
import { Provider } from 'react-redux';
import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';
import { chatActions } from '../store/chatSlice';
import { sessionActions } from '../store/sessionSlice';
import { createAppStore, type AppStore } from '../store/store';
import { sessionMessagesActions } from '../store/sessionMessagesSlice';
import { chatRuntime } from '../runtime/application';
import { Conversation } from './Conversation';
import { ActionButton, Field } from './designSystem';

const { act, create } = require('react-test-renderer');

// Use the package's existing CommonJS build under the Jest Expo resolver.
jest.mock('react-redux', () => require('../../node_modules/react-redux/dist/cjs/react-redux.development.cjs'));

// Native scrolling is represented by a host ref so scroll commands are observable.
jest.mock('react-native/Libraries/Components/ScrollView/ScrollView', () => {
  const React = require('react');
  return { default: React.forwardRef((props: object, ref: unknown) => React.createElement('ScrollView', { ...props, ref })) };
});

jest.mock('../runtime/application', () => ({ chatRuntime: { sendPrivateMessage: jest.fn() } }));
jest.mock('./designSystem', () => {
  const React = require('react');
  return {
    useHanabTheme: () => ({ theme: { colors: { text: 'black', textMuted: 'gray' } } }),
    ActionButton: (props: object) => React.createElement('Button', props),
    Field: (props: object) => React.createElement('Field', props),
    EmptyState: (props: object) => React.createElement('Empty', props),
    Notice: (props: object) => React.createElement('Notice', props),
  };
});

let store: AppStore;
let tree: ReturnType<typeof create>;
let appStateChanged: (state: typeof AppState.currentState) => void;
const scrollToEnd = jest.fn();
const scrollTo = jest.fn();
const send = jest.mocked(chatRuntime.sendPrivateMessage);
const payload = { authenticatedUsername: 'Ada', username: 'Alice' };
function welcome(epoch = 1, username = 'Ada') {
  store.dispatch(sessionActions.welcomeReceived({ epoch, welcome: {
    username, userID: 1, totalGames: 0, playingAtTables: [],
  } }));
}
function observe(who = 'Alice', recipient = 'Ada', msg = 'hello') {
  store.dispatch(chatActions.messageReceived({ epoch: store.getState().session.connectionEpoch,
    authenticatedUsername: store.getState().session.authenticatedUser?.username ?? '', defaultRoom: 'lobby',
    message: { who, recipient, msg, datetime: '2026-10-06', room: '', discord: false, server: false },
  }));
}
function mount(visible = true, username = 'Alice') {
  act(() => {
    tree = create(<Provider store={store}><Conversation username={username} room="table42" visible={visible} /></Provider>, {
      createNodeMock: () => ({ scrollToEnd, scrollTo }),
    });
  });
}
function focus(visible: boolean) {
  act(() => tree.update(<Provider store={store}><Conversation username="Alice" room="table42" visible={visible} /></Provider>));
}
function sendButton() { return tree.root.findAllByType(ActionButton).find((node: { props: { title: string } }) => node.props.title === 'Send'); }

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  jest.clearAllMocks();
  Object.defineProperty(AppState, 'currentState', { configurable: true, value: 'active' });
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
    appStateChanged = listener;
    return { remove: jest.fn() };
  });
  store = createAppStore();
  store.dispatch(sessionActions.connectionStarted({ epoch: 1 }));
  welcome();
});
afterEach(() => {
  if (tree) act(() => tree.unmount());
  jest.restoreAllMocks();
});

test('only the exact visible foreground Conversation consumes its local unread', () => {
  observe();
  observe('Bob');
  mount(false);
  expect(store.getState().sessionMessages.conversations.alice!.unread).toBe(1);
  focus(true);
  expect(store.getState().sessionMessages.conversations.alice!.unread).toBe(0);
  expect(store.getState().sessionMessages.conversations.bob!.unread).toBe(1);
  act(() => appStateChanged('background'));
  act(() => observe());
  expect(store.getState().sessionMessages.conversations.alice!.unread).toBe(1);
  act(() => appStateChanged('active'));
  expect(store.getState().sessionMessages.conversations.alice!.unread).toBe(0);
  focus(false);
  act(() => store.dispatch(sessionMessagesActions.draftChanged({ ...payload, draft: 'hidden draft' })));
  expect(tree.root.findByType(Field).props.editable).toBe(false);
  act(() => tree.root.findByType(Field).props.onChangeText('hidden edit'));
  act(() => sendButton().props.onPress());
  expect(send).not.toHaveBeenCalled();
  expect(store.getState().sessionMessages.drafts.alice).toBe('hidden draft');
  act(() => observe());
  expect(store.getState().sessionMessages.conversations.alice!.unread).toBe(1);
});

test('each explicit Send calls runtime once; false retains draft, true clears without synthesizing transcript', () => {
  mount();
  act(() => tree.root.findByType(Field).props.onChangeText('hello'));
  send.mockReturnValueOnce(false).mockReturnValueOnce(true);
  act(() => sendButton().props.onPress());
  expect(send).toHaveBeenCalledTimes(1);
  expect(send).toHaveBeenLastCalledWith('Alice', 'hello', 'table42');
  expect(store.getState().sessionMessages.drafts.alice).toBe('hello');
  act(() => sendButton().props.onPress());
  expect(send).toHaveBeenCalledTimes(2);
  expect(store.getState().sessionMessages.drafts.alice).toBeUndefined();
  expect(store.getState().sessionMessages.conversations.alice).toBeUndefined();
  act(() => observe('Ada', 'Alice', 'hello'));
  expect(store.getState().sessionMessages.conversations.alice!.messages).toHaveLength(1);
  expect(tree.root.findByType(Field).props.maxLength).toBe(300);
});

test('unconfirmed reconnect disables edits, sending and read until current welcome', () => {
  observe();
  store.dispatch(sessionMessagesActions.draftChanged({ ...payload, draft: 'keep' }));
  store.dispatch(sessionActions.connectionStarted({ epoch: 2 }));
  mount();
  expect(tree.root.findByType(Field).props.editable).toBe(false);
  act(() => tree.root.findByType(Field).props.onChangeText('stale'));
  act(() => sendButton().props.onPress());
  expect(send).not.toHaveBeenCalled();
  expect(store.getState().sessionMessages.drafts.alice).toBe('keep');
  expect(store.getState().sessionMessages.conversations.alice!.unread).toBe(1);
  act(() => welcome(1));
  expect(sendButton().props.disabled).toBe(true);
  act(() => welcome(2));
  expect(tree.root.findByType(Field).props.value).toBe('keep');
  expect(store.getState().sessionMessages.conversations.alice!.unread).toBe(0);
  expect(store.getState().sessionMessages.conversations.alice!.hasReconnectGap).toBe(true);
  act(() => store.dispatch(sessionActions.connectionStarted({ epoch: 3 })));
  act(() => welcome(3, 'Carol'));
  expect(tree.root.findByType(Field).props.value).toBe('');
  expect(store.getState().sessionMessages.conversations).toEqual({});
});

test('New appears for a new observation away from the end without forcing scroll; press follows newest', () => {
  observe();
  mount();
  const history = tree.root.findByType(ScrollView);
  act(() => history.props.onScroll({ nativeEvent: { contentOffset: { y: 50 }, layoutMeasurement: { height: 100 }, contentSize: { height: 500 } } }));
  scrollToEnd.mockClear();
  act(() => observe());
  act(() => history.props.onContentSizeChange(100, 550));
  expect(scrollToEnd).not.toHaveBeenCalled();
  const newest = tree.root.findAllByType(ActionButton).find((node: { props: { title: string } }) => node.props.title === 'New \u2193');
  expect(newest).toBeDefined();
  act(() => newest.props.onPress());
  expect(scrollToEnd).toHaveBeenCalledTimes(1);
  act(() => history.props.onContentSizeChange(100, 600));
  expect(scrollToEnd).toHaveBeenCalledTimes(2);
});


test('restoring the same transcript after reconnect does not create New and restores local scroll', () => {
  observe();
  mount();
  const history = tree.root.findByType(ScrollView);
  act(() => history.props.onScroll({ nativeEvent: { contentOffset: { y: 50 }, layoutMeasurement: { height: 100 }, contentSize: { height: 500 } } }));
  act(() => store.dispatch(sessionActions.connectionStarted({ epoch: 2 })));
  scrollToEnd.mockClear();
  scrollTo.mockClear();
  act(() => welcome(2));
  expect(tree.root.findAllByType(ActionButton).some((node: { props: { title: string } }) => node.props.title === 'New \u2193')).toBe(false);
  expect(scrollToEnd).not.toHaveBeenCalled();
  expect(scrollTo).toHaveBeenCalledWith({ y: 50, animated: false });
});
