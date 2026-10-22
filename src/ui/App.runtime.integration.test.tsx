import React from 'react';
import { AppState } from 'react-native';
import { Provider } from 'react-redux';
import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';

import App from '../../App';
import type { NetworkSession, NetworkSocket, SessionCheckResult } from '../network/types';
import type { GameHistory } from '../protocol/gameProtocol';
import { makeInit } from '../protocol/gameProtocol.fixtures';
import { ChatRuntime } from '../runtime/ChatRuntime';
import { LobbyRuntime } from '../runtime/LobbyRuntime';
import { TerminationRuntime } from '../runtime/terminationRuntime';
import { createAppStore, type AppStore } from '../store/store';
import { BrowsingAppBar } from './BrowsingAppBar';
import { BrowsingNavigation } from './BrowsingNavigation';
import { ActionButton } from './designSystem';
import { C17GameScreen } from './game/C17GameScreen';
import { ClueComposer } from './game/ClueComposer';
import { GameCard } from './game/GameCard';

const { act, create } = require('react-test-renderer');

// Match the existing component-test setup; App and gameplay components stay real.
jest.mock('react-redux', () => require('../../node_modules/react-redux/dist/cjs/react-redux.development.cjs'));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);

// Replace only application singleton wiring. Every runtime uses the test's real
// Redux store and NetworkSession; commands still cross the real transport gate.
jest.mock('../runtime/application', () => ({
  get lobbyRuntime() { return mockRuntime; },
  get chatRuntime() { return mockChatRuntime; },
  get terminationRuntime() { return mockTerminationRuntime; },
  get networkSession() { return mockSession; },
}));

type MessageListener = (event: WebSocketMessageEvent) => void;

class FakeSocket implements NetworkSocket {
  readyState = 0;
  readonly sent: string[] = [];
  private readonly opens = new Set<() => void>();
  private readonly messages = new Set<MessageListener>();
  private readonly errors = new Set<() => void>();
  private readonly closes = new Set<(event: WebSocketCloseEvent) => void>();

  addEventListener(type: 'open', listener: () => void): void;
  addEventListener(type: 'message', listener: MessageListener): void;
  addEventListener(type: 'error', listener: () => void): void;
  addEventListener(type: 'close', listener: (event: WebSocketCloseEvent) => void): void;
  addEventListener(type: string, listener: never): void {
    if (type === 'open') this.opens.add(listener);
    if (type === 'message') this.messages.add(listener);
    if (type === 'error') this.errors.add(listener);
    if (type === 'close') this.closes.add(listener);
  }

  removeEventListener(type: 'open', listener: () => void): void;
  removeEventListener(type: 'message', listener: MessageListener): void;
  removeEventListener(type: 'error', listener: () => void): void;
  removeEventListener(type: 'close', listener: (event: WebSocketCloseEvent) => void): void;
  removeEventListener(type: string, listener: never): void {
    if (type === 'open') this.opens.delete(listener);
    if (type === 'message') this.messages.delete(listener);
    if (type === 'error') this.errors.delete(listener);
    if (type === 'close') this.closes.delete(listener);
  }

  send(data: string): void { this.sent.push(data); }
  close(): void { this.readyState = 3; }
  emitOpen(): void {
    this.readyState = 1;
    for (const listener of [...this.opens]) listener();
  }
  emitMessage(data: string): void {
    for (const listener of [...this.messages]) listener({ data } as WebSocketMessageEvent);
  }
  emitClose(): void {
    this.readyState = 3;
    for (const listener of [...this.closes]) listener({ code: 1006 } as WebSocketCloseEvent);
  }
  snapshotMessages(): MessageListener[] { return [...this.messages]; }
}

class FakeSession implements NetworkSession {
  readonly sockets = [new FakeSocket(), new FakeSocket()] as const;
  private nextSocket = 0;
  checkSession(): Promise<SessionCheckResult> { return Promise.resolve({ kind: 'valid' }); }
  submitLogin(): Promise<void> { return Promise.resolve(); }
  logout(): Promise<void> { return Promise.resolve(); }
  fetchTaggedGames(): Promise<GameHistory> { return Promise.resolve([]); }
  searchTag(): Promise<GameHistory> { return Promise.resolve([]); }
  openSocket(): Promise<NetworkSocket> {
    const socket = this.sockets[this.nextSocket++];
    if (socket === undefined) throw new Error('Unexpected socket attempt');
    return Promise.resolve(socket);
  }
}

let mockSession: FakeSession;
let mockRuntime: LobbyRuntime;
let mockChatRuntime: ChatRuntime;
let mockTerminationRuntime: TerminationRuntime;
let store: AppStore;
let tree: ReturnType<typeof create> | undefined;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  jest.useFakeTimers();
  Object.defineProperty(AppState, 'currentState', { configurable: true, value: 'active' });
  store = createAppStore();
  mockSession = new FakeSession();
  mockRuntime = new LobbyRuntime(mockSession, store);
  mockTerminationRuntime = new TerminationRuntime(mockRuntime, store);
  mockChatRuntime = new ChatRuntime(mockRuntime, mockTerminationRuntime, store);
});

// Full App + real card rendering is slower than the existing isolated UI tests.
jest.setTimeout(30_000);

afterEach(() => {
  if (tree) act(() => tree.unmount());
  tree = undefined;
  mockRuntime.disconnect();
  jest.useRealTimers();
});

function welcome(socket: FakeSocket, tableID = 123) {
  socket.emitOpen();
  socket.emitMessage(`welcome ${JSON.stringify({
    userID: 1, username: 'Ada', totalGames: 0, playingAtTables: [tableID],
  })}`);
  socket.emitMessage('userList []');
  socket.emitMessage('tableList []');
}

function history(tableID = 123, sharedReview = false) {
  return { tableID, list: [
    ...Array.from({ length: 5 }, (_, order) => ({
      type: 'draw', playerIndex: 0, order, suitIndex: sharedReview ? 0 : -1, rank: sharedReview ? 1 : -1,
    })),
    ...Array.from({ length: 5 }, (_, index) => ({
      type: 'draw', playerIndex: 1, order: index + 5, suitIndex: index, rank: index + 1,
    })),
    { type: 'status', clues: 8, score: 0, maxScore: 25 },
    { type: 'turn', num: 0, currentPlayerIndex: 0 },
  ] };
}

function bootstrap(socket: FakeSocket, tableID = 123, sharedReview = false) {
  socket.emitMessage(`tableStart ${JSON.stringify({ tableID, replay: sharedReview })}`);
  socket.emitMessage(`init ${JSON.stringify(makeInit({
    tableID,
    ...(sharedReview ? {
      replay: true, sharedReplay: true, databaseID: 77,
      datetimeFinished: '2026-08-31T00:10:00Z', sharedReplayLeader: 'Bob',
    } : {}),
  }))}`);
  socket.emitMessage(`gameActionList ${JSON.stringify(history(tableID, sharedReview))}`);
}

async function mountLive(sharedReview = false) {
  await act(async () => { tree = create(<Provider store={store} stabilityCheck="never"><App /></Provider>); });
  const socket = mockSession.sockets[0];
  act(() => welcome(socket));
  act(() => bootstrap(socket, 123, sharedReview));
  expect(store.getState().session.phase).toBe('ready');
  expect(liveRoom()).toMatchObject({ kind: 'live_game', tableID: 123, role: 'player' });
  expect(tree.root.findByType(C17GameScreen).props.presentationVisible).toBe(true);
  expect(tree.root.findAllByType(BrowsingAppBar)).toHaveLength(0);
  return socket;
}

function liveRoom() {
  const room = store.getState().room.room;
  if (room.kind !== 'live_game') throw new Error(`Expected LIVE, got ${room.kind}`);
  return room;
}

function buttons(title: string) {
  return tree.root.findAllByType(ActionButton).filter((node: { props: { title: string } }) => node.props.title === title);
}

function pressButton(title: string) {
  const matches = buttons(title);
  expect(matches).toHaveLength(1);
  expect(matches[0].props.disabled).not.toBe(true);
  act(() => matches[0].props.onPress());
}

function selectCard(order: number) {
  const cards = tree.root.findAllByType(GameCard).filter((node: { props: { knowledge: { order: number } } }) => node.props.knowledge.order === order);
  expect(cards).toHaveLength(1);
  act(() => cards[0].props.onSelect());
}

function returnToRoom() {
  const bar = tree.root.findByType(BrowsingAppBar);
  const control = bar.findAll((node: { props: { accessibilityRole?: string; onPress?: unknown } }) =>
    node.props.accessibilityRole === 'button' && node.props.onPress === bar.props.onReturn)[0];
  expect(control).toBeDefined();
  act(() => control.props.onPress());
  expect(tree.root.findAllByType(BrowsingAppBar)).toHaveLength(0);
  expect(tree.root.findByType(C17GameScreen).props.presentationVisible).toBe(true);
}

function expectDisarmed() {
  expect(tree.root.findAllByType(GameCard).every((node: { props: { selected: boolean } }) => !node.props.selected)).toBe(true);
  expect(buttons('Play')).toHaveLength(0);
  expect(buttons('Discard')).toHaveLength(0);
  expect(tree.root.findAllByType(ClueComposer).every((node: { props: { previewState: unknown; targetName: unknown } }) =>
    node.props.previewState === null && node.props.targetName === null)).toBe(true);
}

function browsePeople() {
  const navigation = tree.root.findByType(BrowsingNavigation);
  const people = navigation.findAllByType(ActionButton).find((node: { props: { title: string } }) => node.props.title === 'People');
  act(() => people.props.onPress());
  expect(tree.root.findByType(BrowsingAppBar).props.title).toBe('People');
}

test.each(['card', 'clue'] as const)('Home hides %s interaction, accepts authoritative updates, and Return stays disarmed', async (interaction) => {
  const socket = await mountLive();
  if (interaction === 'card') {
    selectCard(0);
    expect(buttons('Play')).toHaveLength(1);
    expect(buttons('Play')[0].props.disabled).toBe(false);
  } else {
    const target = tree.root.findAllByProps({ accessibilityLabel: 'Player Bob' })[0];
    act(() => target.props.onPress());
    const composer = tree.root.findByType(ClueComposer);
    act(() => composer.props.onPreview('rank', 1));
    expect(tree.root.findByType(ClueComposer).props.previewState).toEqual({ type: 'rank', value: 1 });
    expect(buttons('Give clue')[0].props.disabled).toBe(false);
  }
  const before = liveRoom();
  const sentBefore = [...socket.sent];
  pressButton('Home');
  expect(tree.root.findByType(BrowsingAppBar).props.title).toBe('Home');
  expect(tree.root.findByType(C17GameScreen).props.presentationVisible).toBe(false);
  expect(liveRoom()).toBe(before);
  expectDisarmed();

  act(() => {
    socket.emitMessage('gameAction {"tableID":123,"action":{"type":"clue","clue":{"type":1,"value":1},"giver":0,"list":[5],"target":1,"turn":0}}');
    socket.emitMessage('gameAction {"tableID":123,"action":{"type":"turn","num":1,"currentPlayerIndex":1}}');
  });
  expect(liveRoom()).toMatchObject({
    tableID: 123, role: 'player', gameLoadEpoch: before.gameLoadEpoch,
    clientState: { ongoingGame: { clueTokens: 7, turn: { currentPlayerIndex: 1 } } },
  });
  expect(tree.root.findByType(BrowsingAppBar).props.title).toBe('Home');
  returnToRoom();
  expectDisarmed();
  expect(liveRoom().clientState.visibleState).toBe(liveRoom().clientState.ongoingGame);
  expect(store.getState().room.pendingGameplayAction).toBeNull();
  expect(socket.sent).toEqual(sentBefore);
  expect(liveRoom().clientState.ongoingGame.turn.currentPlayerIndex).toBe(1);
});

test('browsing survives reconnect and authoritative rebootstrap; Return never replays a pending action or rearms selection', async () => {
  const first = await mountLive();
  const oldEpoch = store.getState().session.connectionEpoch;
  const oldLoad = liveRoom().gameLoadEpoch;
  const authoritativeHands = liveRoom().clientState.ongoingGame.hands;
  selectCard(0);
  const beforePlay = first.sent.length;
  pressButton('Play');
  expect(first.sent.slice(beforePlay)).toEqual(['action {"tableID":123,"type":0,"target":0}']);
  expect(store.getState().room.pendingGameplayAction).not.toBeNull();
  const pending = store.getState().room.pendingGameplayAction;
  selectCard(1);
  expect(tree.root.findAllByType(GameCard).some((node: { props: { selected: boolean } }) => node.props.selected)).toBe(true);
  const sentBeforeBrowse = [...first.sent];
  pressButton('Home');
  browsePeople();
  expect(store.getState().room.pendingGameplayAction).toBe(pending);
  expect(first.sent).toEqual(sentBeforeBrowse);
  const staleMessages = first.snapshotMessages();

  act(() => first.emitClose());
  expect(tree.root.findByType(BrowsingAppBar).props.title).toBe('People');
  expect(tree.root.findByType(BrowsingAppBar).props.returnPresentation).toMatchObject({ status: 'Reconnecting' });
  await act(async () => { jest.advanceTimersByTime(1_000); });
  const second = mockSession.sockets[1];
  const newEpoch = store.getState().session.connectionEpoch;
  expect(newEpoch).toBeGreaterThan(oldEpoch);
  expect(store.getState().room.room).toEqual({ kind: 'none' });
  expect(store.getState().room.pendingGameplayAction).toBeNull();
  expect(tree.root.findByType(BrowsingAppBar).props.title).toBe('People');
  expect(second.sent).toEqual([]);

  act(() => welcome(second));
  expect(store.getState().room.pendingRecovery).toEqual({ tableID: 123, role: 'player' });
  // Reattend comes only from the authoritative welcome resume hint.
  expect(second.sent).toEqual(['tableReattend {"tableID":123}']);
  expect(tree.root.findByType(BrowsingAppBar).props.title).toBe('People');
  act(() => bootstrap(second));
  expect(liveRoom()).toMatchObject({ tableID: 123, role: 'player' });
  expect(liveRoom().gameLoadEpoch).toBeGreaterThan(oldLoad);
  expect(store.getState().room.connectionEpoch).toBe(newEpoch);
  expect(tree.root.findByType(C17GameScreen).props.presentationVisible).toBe(false);
  expect(tree.root.findByType(BrowsingAppBar).props.title).toBe('People');

  const recoveredState = store.getState();
  act(() => {
    for (const listener of staleMessages) {
      listener({ data: 'gameAction {"tableID":123,"action":{"type":"turn","num":99,"currentPlayerIndex":1}}' } as WebSocketMessageEvent);
      listener({ data: 'tableStart {"tableID":999,"replay":false}' } as WebSocketMessageEvent);
    }
  });
  expect(store.getState()).toBe(recoveredState);
  expect(first.snapshotMessages()).toHaveLength(0);
  returnToRoom();
  expectDisarmed();
  expect(liveRoom().clientState.ongoingGame.hands).toEqual(authoritativeHands);
  expect(liveRoom().clientState.ongoingGame.turn.currentPlayerIndex).toBe(0);
  expect(store.getState().room.pendingGameplayAction).toBeNull();
  expect(first.sent).toEqual(sentBeforeBrowse);
  expect(second.sent).toEqual([
    'tableReattend {"tableID":123}',
    'getGameInfo1 {"tableID":123}',
    'getGameInfo2 {"tableID":123}',
    'loaded {"tableID":123}',
  ]);

  // The new room is actionable, but requires a fresh selection and explicit Play.
  const recoveredFrames = [...second.sent];
  selectCard(0);
  pressButton('Play');
  expect(second.sent).toEqual([...recoveredFrames, 'action {"tableID":123,"type":0,"target":0}']);
  expect(store.getState().room.pendingGameplayAction).toMatchObject({
    connectionEpoch: newEpoch, tableID: 123, gameLoadEpoch: liveRoom().gameLoadEpoch,
  });
});

test('a peer rematch migrates room ownership while preserving browsing focus until explicit Return', async () => {
  const socket = await mountLive(true);
  const oldEpoch = store.getState().session.connectionEpoch;
  const oldLoad = liveRoom().gameLoadEpoch;
  expect(liveRoom().sharedReplay).toBe(true);
  const sentBeforeBrowse = socket.sent.length;
  pressButton('Browse');
  browsePeople();

  act(() => socket.emitMessage('boot {"TableID":123}'));
  expect(liveRoom().tableID).toBe(123);
  expect(store.getState().room.rematchTransition).toMatchObject({ oldTableID: 123, role: 'player' });
  expect(tree.root.findByType(BrowsingAppBar).props.title).toBe('People');
  act(() => socket.emitMessage('user {"userID":1,"name":"Ada","status":1,"tableID":456,"hyphenated":false,"inactive":false}'));
  // Render the roomless migration boundary separately, so focus preservation is exercised.
  expect(store.getState().room.room).toEqual({ kind: 'none' });
  expect(store.getState().room.rematchTransition).toMatchObject({ newTableID: 456 });
  expect(tree.root.findByType(BrowsingAppBar).props.title).toBe('People');
  expect(socket.sent.slice(sentBeforeBrowse)).toEqual([]);

  act(() => bootstrap(socket, 456));
  expect(liveRoom()).toMatchObject({ tableID: 456, role: 'player', sharedReplay: false });
  expect(liveRoom().gameLoadEpoch).toBeGreaterThan(oldLoad);
  expect(store.getState().session.connectionEpoch).toBe(oldEpoch);
  expect(store.getState().room.connectionEpoch).toBe(oldEpoch);
  expect(store.getState().room.rematchTransition).toBeNull();
  expect(tree.root.findByType(BrowsingAppBar).props.title).toBe('People');
  expect(tree.root.findByType(C17GameScreen).props.presentationVisible).toBe(false);

  const newRoom = liveRoom();
  act(() => {
    socket.emitMessage('boot {"TableID":123}');
    socket.emitMessage('replaySegment {"tableID":123,"segment":0}');
    socket.emitMessage('gameAction {"tableID":123,"action":{"type":"turn","num":99,"currentPlayerIndex":1}}');
  });
  expect(liveRoom()).toBe(newRoom);
  returnToRoom();
  expectDisarmed();
  expect(liveRoom().clientState.visibleState).toBe(liveRoom().clientState.ongoingGame);
  expect(store.getState().room.pendingGameplayAction).toBeNull();
  expect(socket.sent.slice(sentBeforeBrowse)).toEqual([
    'getGameInfo1 {"tableID":456}',
    'getGameInfo2 {"tableID":456}',
    'loaded {"tableID":456}',
  ]);
});
