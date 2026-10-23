import React from 'react';
import { Alert, AppState, Dimensions, Text, TextInput, View } from 'react-native';
import { Provider } from 'react-redux';
import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';

import App from '../../App';
import { bootstrap, FakeSession, history, welcome } from './testUtils/appRuntimeHarness';
import { makeInit } from '../protocol/gameProtocol.fixtures';
import { ChatRuntime } from '../runtime/ChatRuntime';
import { LobbyRuntime } from '../runtime/LobbyRuntime';
import { TerminationRuntime } from '../runtime/terminationRuntime';
import { createAppStore, type AppStore } from '../store/store';
import { BrowsingAppBar } from './BrowsingAppBar';
import { BrowsingNavigation } from './BrowsingNavigation';
import { ActionButton } from './designSystem';
import { GameBootstrapStatus } from './GameBootstrapStatus';
import { C17GameScreen } from './game/C17GameScreen';
import { ClueComposer } from './game/ClueComposer';
import { GameCard } from './game/GameCard';
import { NoteEditor } from './game/NoteEditor';
import { getDisplayedHandOrders } from './game/gamePresentation';
import { PregameScreen } from './screens/PregameScreen';
import type { SessionCheckResult } from '../network/types';
import * as credentialAccounts from '../platform/credentialAccounts';

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
  jest.restoreAllMocks();
  jest.useRealTimers();
});

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

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

function finishLiveGame(socket: FakeSession['sockets'][number], endCondition = 1) {
  act(() => {
    socket.emitMessage(`gameAction ${JSON.stringify({ tableID: 123, action: { type: 'gameOver', endCondition, playerIndex: 0, votes: null } })}`);
    socket.emitMessage('gameAction {"tableID":123,"action":{"type":"playerTimes","playerTimes":[60000,60000],"duration":300000}}');
  });
  expect(liveRoom().clientState.finished).toBe(false);
  act(() => {
    socket.emitMessage(`gameHistory ${JSON.stringify([{
      id: 77, options: makeInit().options, seed: 'p2v0s1', score: 0, numTurns: 0, endCondition,
      datetimeStarted: '2026-08-31T00:00:00Z', datetimeFinished: '2026-10-23T00:05:00Z',
      numGamesOnThisSeed: 1, playerNames: ['Ada', 'Bob'], incrementNumGames: true, tags: '',
    }])}`);
    socket.emitMessage(`cardIdentities ${JSON.stringify({ tableID: 123, cardIdentities: Array.from({ length: 10 }, (_, order) => ({ suitIndex: order % 5, rank: order % 5 + 1 })) })}`);
    socket.emitMessage('finishOngoingGame {"tableID":123,"databaseID":77,"sharedReplayLeader":"Ada"}');
  });
  expect(liveRoom().clientState.finished).toBe(true);
}

test.each([[1, 'Normal completion'], [4, 'Terminated by player']] as Array<[number, string]>)('real authoritative finish %s announces once with final score/reason and sends nothing', async (condition, reason) => {
  const socket = await mountLive();
  const before = [...socket.sent];
  expect(buttons('Continue to replay')).toHaveLength(0);
  finishLiveGame(socket, condition);
  expect(buttons('Continue to replay')).toHaveLength(1);
  const popup = tree.root.findAllByProps({ testID: 'game-finished-popup' })[0];
  expect(popup.findAllByProps({ accessibilityLabel: 'Final score 0 out of 25' }).length).toBeGreaterThan(0);
  expect(popup.findAllByType(Text).some((node: { props: { children: unknown } }) => node.props.children === reason)).toBe(true);
  expect(socket.sent).toEqual(before);
  pressButton('Continue to replay');
  act(() => socket.emitMessage('finishOngoingGame {"tableID":123,"databaseID":77,"sharedReplayLeader":"Ada"}'));
  act(() => mockRuntime.navigateReplaySegment(0));
  pressButton('Home'); returnToRoom();
  expect(buttons('Continue to replay')).toHaveLength(0);
  expect(socket.sent.filter((frame: string) => frame.startsWith('action '))).toEqual([]);
});

test('finished hydration and a finish observed while browsing do not announce on Return', async () => {
  const socket = await mountLive();
  pressButton('Home');
  finishLiveGame(socket);
  returnToRoom();
  expect(buttons('Continue to replay')).toHaveLength(0);
  // Rebootstrap an already-finished shared replay into the same mounted App.
  act(() => bootstrap(socket, 123, true));
  expect(buttons('Continue to replay')).toHaveLength(0);
});

test('a spectator observes an opponent finish once without creating a gameplay send', async () => {
  await act(async () => { tree = create(<Provider store={store} stabilityCheck="never"><App /></Provider>); });
  const socket = mockSession.sockets[0];
  act(() => {
    socket.emitOpen();
    socket.emitMessage('welcome {"userID":3,"username":"Carol","totalGames":0,"playingAtTables":[],"disconSpectatingTable":123,"disconShadowingSeat":-1}');
    socket.emitMessage('userList []'); socket.emitMessage('tableList []');
    socket.emitMessage('tableStart {"tableID":123,"replay":false}');
    socket.emitMessage(`init ${JSON.stringify(makeInit({ spectating: true }))}`);
    socket.emitMessage(`gameActionList ${JSON.stringify(history())}`);
  });
  expect(liveRoom().role).toBe('spectator');
  const before = [...socket.sent];
  finishLiveGame(socket);
  expect(buttons('Continue to replay')).toHaveLength(1);
  pressButton('Continue to replay');
  expect(socket.sent).toEqual(before);
});

test.each([false, true])('direct Exit Replay has no confirmation for shared leader=%s and waits for authority', async (leader) => {
  const socket = await mountLive(true);
  if (leader) act(() => socket.emitMessage('replayLeader {"tableID":123,"name":"Ada"}'));
  const alert = jest.spyOn(Alert, 'alert');
  const before = [...socket.sent];
  expect(buttons('Home')).toHaveLength(1);
  expect(buttons('Browse')).toHaveLength(0);
  const exit = buttons('Exit Replay')[0].props.onPress;
  act(() => { exit(); exit(); });
  expect(alert).not.toHaveBeenCalled();
  expect(socket.sent.slice(before.length)).toEqual(['tableUnattend {"tableID":123}']);
  expect(liveRoom().tableID).toBe(123);
  expect(store.getState().room.pendingUnattendTableID).toBe(123);
  expect(tree.root.findByType(C17GameScreen).props.presentationVisible).toBe(true);
  act(() => socket.emitMessage('user {"userID":2,"name":"Bob","status":0,"hyphenated":false,"inactive":false}'));
  expect(liveRoom().tableID).toBe(123);
  act(() => socket.emitMessage('user {"userID":1,"name":"Ada","status":0,"hyphenated":false,"inactive":false}'));
  expect(store.getState().room.room.kind).toBe('none');
  expect(tree.root.findByType(BrowsingAppBar).props.title).toBe('Home');
  expect(socket.sent.filter((frame: string) => frame.startsWith('action '))).toEqual([]);
});

test('own ongoing Rewind has Live rather than Exit Replay and never unattends', async () => {
  const socket = await mountLive();
  const before = [...socket.sent];
  act(() => expect(mockRuntime.navigateReplaySegment(0)).toBe(true));
  expect(liveRoom().clientState.replay.active).toBe(true);
  expect(buttons('Exit Replay')).toHaveLength(0);
  pressButton('Live');
  expect(liveRoom().clientState.replay.active).toBe(false);
  expect(socket.sent).toEqual(before);
});

test('a replay exit callback cannot retarget a newer load of the same table', async () => {
  const socket = await mountLive(true);
  const obsoleteExit = buttons('Exit Replay')[0].props.onPress;
  const oldLoad = liveRoom().gameLoadEpoch;
  act(() => bootstrap(socket, 123, true));
  expect(liveRoom().gameLoadEpoch).toBeGreaterThan(oldLoad);
  const before = [...socket.sent];
  act(() => obsoleteExit());
  expect(socket.sent).toEqual(before);
  expect(store.getState().room.pendingUnattendTableID).toBeNull();
  pressButton('Exit Replay');
  expect(socket.sent.slice(before.length)).toEqual(['tableUnattend {"tableID":123}']);
});

test('hidden, failed-send and disconnected replay exits never falsely claim departure or retry', async () => {
  const socket = await mountLive(true);
  const exit = buttons('Exit Replay')[0].props.onPress;
  const before = [...socket.sent];
  pressButton('Home');
  act(() => exit());
  expect(socket.sent).toEqual(before);
  returnToRoom();
  const send = jest.spyOn(socket, 'send').mockImplementationOnce(() => { throw new Error('test send failure'); });
  act(() => exit());
  expect(liveRoom().tableID).toBe(123);
  expect(store.getState().room.pendingUnattendTableID).toBeNull();
  expect(tree.root.findByType(C17GameScreen).props.presentationVisible).toBe(true);
  send.mockRestore();
  act(() => exit());
  expect(store.getState().room.pendingUnattendTableID).toBe(123);
  act(() => socket.emitClose());
  const afterClose = [...socket.sent];
  act(() => exit());
  expect(socket.sent).toEqual(afterClose);
  expect(store.getState().room.pendingUnattendTableID).toBeNull();
  expect(liveRoom().tableID).toBe(123);
  expect(store.getState().session.phase).toBe('closed');
  expect(socket.sent.filter((frame: string) => frame.startsWith('tableUnattend '))).toHaveLength(1);
});

test('Home always opens Home but authoritative Exit Replay restores its captured History origin', async () => {
  await act(async () => { tree = create(<Provider store={store} stabilityCheck="never"><App /></Provider>); });
  const socket = mockSession.sockets[0];
  act(() => {
    socket.emitOpen();
    socket.emitMessage('welcome {"userID":1,"username":"Ada","totalGames":0,"playingAtTables":[]}');
    socket.emitMessage('userList []');
    socket.emitMessage('tableList []');
  });
  act(() => tree.root.findByType(BrowsingNavigation).props.onNavigate('history'));
  pressButton('Open replay');
  const input = tree.root.findAllByType(TextInput).find((node: { props: { placeholder?: string } }) => node.props.placeholder === 'Replay link or database ID');
  act(() => input.props.onChangeText('77'));
  pressButton('Open');
  act(() => {
    socket.emitMessage('tableStart {"tableID":123,"replay":true}');
    socket.emitMessage(`init ${JSON.stringify(makeInit({ replay: true, databaseID: 77, datetimeFinished: '2026-10-23T00:10:00Z' }))}`);
    socket.emitMessage(`gameActionList ${JSON.stringify(history(123, true))}`);
  });
  expect(tree.root.findByType(C17GameScreen).props.presentationVisible).toBe(true);
  const before = [...socket.sent];
  pressButton('Home');
  expect(tree.root.findByType(BrowsingAppBar).props.title).toBe('Home');
  expect(socket.sent).toEqual(before);
  returnToRoom();
  pressButton('Exit Replay');
  expect(liveRoom().tableID).toBe(123);
  act(() => socket.emitMessage('user {"userID":1,"name":"Ada","status":0,"hyphenated":false,"inactive":false}'));
  expect(tree.root.findByType(BrowsingAppBar).props.title).toBe('History');
});

test('landscape unread measurement preserves mounted hands, selection and attendance', async () => {
  const frameHook = require('react-native-safe-area-context').useSafeAreaFrame;
  const previousFrameImplementation = frameHook.getMockImplementation();
  const previousWindow = Dimensions.get('window');
  const previousScreen = Dimensions.get('screen');
  frameHook.mockReturnValue({ x: 0, y: 0, width: 960, height: 440 });
  try {
    Dimensions.set({ window: { ...previousWindow, fontScale: 1 }, screen: { ...previousScreen, fontScale: 1 } });
    const socket = await mountLive();
    const measured = (testID: string, width: number, height: number) => {
      const node = tree.root.findAllByProps({ testID })
        .find((candidate: { props: { onLayout?: unknown } }) => typeof candidate.props.onLayout === 'function');
      expect(node).toBeDefined();
      act(() => node.props.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width, height } } }));
    };
    // Test-supplied native layout events exercise ownership; these are not Android
    // font measurements or physical safe-area acceptance.
    measured('c17-landscape-body', 928, 400);
    measured('c17-landscape-header', 78, 78);
    measured('game-header-home', 48, 40);
    measured('game-header-menu', 60, 40);
    measured('game-header-chat-probe', 60, 40);
    measured('c17-metric-probe-actual', 215, 29);
    measured('c17-metric-probe-maximum', 270, 29);
    const cards = () => tree.root.findAllByType(GameCard);
    expect(cards()).toHaveLength(5);
    const before = cards();
    const beforeFrames = [...socket.sent];
    act(() => before[0].props.onSelect());
    const selectedBeforeChat = cards().map((node: { props: { selected: boolean } }) => node.props.selected);
    act(() => socket.emitMessage('chat {"room":"table123","msg":"Layout regression","who":"Bob","source":"user","datetime":"2026-10-23T13:00:00Z"}'));
    expect(store.getState().chat.unreadByRoom.table123).toBe(1);
    expect(cards()).toEqual(before);
    expect(cards().map((node: { props: { selected: boolean } }) => node.props.selected)).toEqual(selectedBeforeChat);
    measured('game-header-chat-probe', 78, 40);
    expect(cards()).toEqual(before);
    const visibleChat = tree.root.findAllByProps({ testID: 'game-header-chat' })[0].findByType(ActionButton);
    expect(visibleChat.props.title).toBe('Chat (1)');
    act(() => visibleChat.props.onPress());
    expect(store.getState().chat.unreadByRoom.table123 ?? 0).toBe(0);
    expect(cards()).toEqual(before);
    measured('game-header-chat-probe', 60, 40);
    expect(cards()).toEqual(before);
    expect(liveRoom().tableID).toBe(123);
    expect(socket.sent.filter((frame: string) => frame.startsWith('action ')))
      .toEqual(beforeFrames.filter((frame) => frame.startsWith('action ')));
  } finally {
    // This hook is already jest.fn in the native mock; restoreAllMocks does not
    // restore a replacement implementation on a pre-existing mock function.
    // The safe-area mock's original implementation uses context hooks. Unmount
    // before restoring it so no mounted provider changes its hook structure.
    if (tree) act(() => tree.unmount());
    tree = undefined;
    frameHook.mockImplementation(previousFrameImplementation);
    Dimensions.set({ window: previousWindow, screen: previousScreen });
  }
});

test('landscape note replacement preserves mounted cards, rejects switching, and saves only the owned order', async () => {
  const frameHook = require('react-native-safe-area-context').useSafeAreaFrame;
  const previousFrameImplementation = frameHook.getMockImplementation();
  const previousWindow = Dimensions.get('window');
  const previousScreen = Dimensions.get('screen');
  frameHook.mockReturnValue({ x: 0, y: 0, width: 960, height: 440 });
  try {
    Dimensions.set({ window: { ...previousWindow, fontScale: 1 }, screen: { ...previousScreen, fontScale: 1 } });
    const socket = await mountLive();
    const measured = (testID: string, width: number, height: number) => {
      const node = tree.root.findAllByProps({ testID })
        .find((candidate: { props: { onLayout?: unknown } }) => typeof candidate.props.onLayout === 'function');
      act(() => node.props.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width, height } } }));
    };
    measured('c17-landscape-body', 928, 400);
    measured('c17-landscape-header', 72, 72);
    measured('game-header-home', 48, 40);
    measured('game-header-menu', 60, 40);
    measured('game-header-chat-probe', 60, 40);
    measured('c17-metric-probe-actual', 215, 29);
    measured('c17-metric-probe-maximum', 270, 29);
    const before = tree.root.findAllByType(GameCard);
    const sizes = before.map((node: { props: { height: number } }) => node.props.height);
    expect(before).toHaveLength(5);
    const room = liveRoom();
    const order = getDisplayedHandOrders(room.clientState.visibleState!.hands[room.clientState.metadata.ourPlayerIndex!], store.getState().session.cardPresentationSettings.reverseHands)[0];
    act(() => before[0].props.onDoublePress());
    measured('note-editor-footer-probe', 150, 44);
    const editor = () => tree.root.findByType(NoteEditor);
    const field = () => editor().findByType(TextInput);
    expect(editor().props.visible).toBe(true);
    expect(field().props.autoFocus).toBe(false);
    act(() => field().props.onChangeText('stable draft'));
    act(() => before[1].props.onSelect());
    act(() => before[1].props.onDoublePress());
    expect(field().props.value).toBe('stable draft');
    expect(tree.root.findAllByType(GameCard)).toEqual(before);
    expect(tree.root.findAllByType(GameCard).map((node: { props: { height: number } }) => node.props.height)).toEqual(sizes);
    expect(socket.sent.filter((frame: string) => frame.startsWith('note ') || frame.startsWith('action '))).toEqual([]);
    act(() => expect(editor().props.backRef.current()).toBe(true));
    expect(editor().props.visible).toBe(false);
    expect(tree.root.findByType(C17GameScreen).props.presentationVisible).toBe(true);
    act(() => before[0].props.onDoublePress());
    measured('note-editor-footer-probe', 150, 44);
    act(() => field().props.onChangeText('stable draft'));
    act(() => {
      socket.emitMessage(`gameAction ${JSON.stringify({ tableID: 123, action: { type: 'play', playerIndex: 0, order, suitIndex: 0, rank: 1 } })}`);
      socket.emitMessage('gameAction {"tableID":123,"action":{"type":"draw","playerIndex":0,"order":10,"suitIndex":-1,"rank":-1}}');
      socket.emitMessage('gameAction {"tableID":123,"action":{"type":"turn","num":1,"currentPlayerIndex":1}}');
    });
    expect(field().props.value).toBe('stable draft');
    const save = tree.root.findAllByProps({ testID: 'note-editor-footer' })[0].findAllByType(ActionButton)
      .find((node: { props: { title: string } }) => node.props.title === 'Save');
    act(() => save.props.onPress());
    expect(socket.sent.filter((frame: string) => frame.startsWith('note ')))
      .toEqual([`note ${JSON.stringify({ tableID: 123, order, note: 'stable draft' })}`]);
    expect(socket.sent.filter((frame: string) => frame.startsWith('action '))).toEqual([]);
    expect(editor().props.visible).toBe(false);
    expect(liveRoom().tableID).toBe(123);
    expect(tree.root.findAllByType(GameCard)).toHaveLength(5);
  } finally {
    if (tree) act(() => tree.unmount());
    tree = undefined;
    frameHook.mockImplementation(previousFrameImplementation);
    Dimensions.set({ window: previousWindow, screen: previousScreen });
  }
});

function pregame(socket: FakeSession['sockets'][number]) {
  const stats = {
    numGames: 0,
    variant: { numGames: 0, averageScore: 0, numStrikeouts: 0, bestScores: [] },
  };
  socket.emitMessage(`game ${JSON.stringify({
    tableID: 123, name: 'Session probe room', owner: 1,
    players: ['Ada', 'Bob'].map((name, index) => ({
      index, name, you: index === 0, present: true, stats,
    })),
    options: makeInit().options, passwordProtected: false, maxPlayers: 5,
  })}`);
  socket.emitMessage('joined {"tableID":123}');
}

test('landscape Clue preview preserves card geometry and only explicit Give can send once', async () => {
  const frameHook = require('react-native-safe-area-context').useSafeAreaFrame;
  const previousFrameImplementation = frameHook.getMockImplementation();
  const previousWindow = Dimensions.get('window');
  const previousScreen = Dimensions.get('screen');
  frameHook.mockReturnValue({ x: 0, y: 0, width: 960, height: 440 });
  try {
    Dimensions.set({ window: { ...previousWindow, fontScale: 1 }, screen: { ...previousScreen, fontScale: 1 } });
    const socket = await mountLive();
    const measured = (testID: string, width: number, height: number) => {
      const node = tree.root.findAllByProps({ testID })
        .find((candidate: { props: { onLayout?: unknown } }) => typeof candidate.props.onLayout === 'function');
      expect(node).toBeDefined();
      act(() => node.props.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width, height } } }));
    };
    measured('c17-landscape-body', 928, 400);
    measured('c17-landscape-header', 72, 72);
    measured('game-header-home', 48, 40);
    measured('game-header-menu', 60, 40);
    measured('game-header-chat-probe', 60, 40);
    measured('c17-metric-probe-actual', 215, 29);
    measured('c17-metric-probe-maximum', 270, 29);
    const cards = tree.root.findAllByType(GameCard);
    const heights = cards.map((node: { props: { height: number } }) => node.props.height);
    expect(cards).toHaveLength(5);
    const beforeActions = socket.sent.filter((frame) => frame.startsWith('action '));
    const target = tree.root.findAllByProps({ accessibilityLabel: 'Player Bob' })
      .find((node: { props: { onPress?: unknown } }) => typeof node.props.onPress === 'function');
    expect(target).toBeDefined();
    act(() => target.props.onPress());
    const composer = tree.root.findByType(ClueComposer);
    expect(composer.props.boundedLandscape).toBe(true);
    act(() => composer.props.onPreview('rank', 1));
    expect(composer.props.preview.touchedOrders.length).toBeGreaterThan(0);
    expect(socket.sent.filter((frame) => frame.startsWith('action '))).toEqual(beforeActions);
    expect(tree.root.findAllByType(GameCard)).toEqual(cards);
    expect(tree.root.findAllByType(GameCard).map((node: { props: { height: number } }) => node.props.height)).toEqual(heights);
    const give = tree.root.findAllByProps({ accessibilityLabel: 'Give clue' })
      .find((node: { props: { onPress?: unknown } }) => typeof node.props.onPress === 'function');
    expect(give).toBeDefined();
    expect(give.props.disabled).toBe(false);
    act(() => { give.props.onPress(); give.props.onPress(); });
    expect(socket.sent.filter((frame) => frame.startsWith('action ')).slice(beforeActions.length))
      .toEqual(['action {"tableID":123,"type":3,"target":1,"value":1}']);
    expect(liveRoom().tableID).toBe(123);
  } finally {
    // The safe-area mock's original implementation uses context hooks. Unmount
    // before restoring it so no mounted provider changes its hook structure.
    if (tree) act(() => tree.unmount());
    tree = undefined;
    frameHook.mockImplementation(previousFrameImplementation);
    Dimensions.set({ window: previousWindow, screen: previousScreen });
  }
});

function welcomeLobby(socket: FakeSession['sockets'][number]) {
  socket.emitOpen();
  socket.emitMessage('welcome {"userID":1,"username":"Ada","totalGames":0,"playingAtTables":[]}');
  socket.emitMessage('userList []');
  socket.emitMessage('tableList []');
}

test('a late missing HTTP probe cannot reset the newer session reached through visible pregame Retry', async () => {
  await act(async () => { tree = create(<Provider store={store}><App /></Provider>); });
  const first = mockSession.sockets[0];
  act(() => { welcome(first); pregame(first); });
  expect(store.getState().room.room.kind).toBe('pregame');
  expect(tree.root.findByType(PregameScreen).props.presentationVisible).toBe(true);
  act(() => first.emitClose());

  const older = deferred<{ kind: 'missing' }>();
  const newer = deferred<{ kind: 'valid' }>();
  const check = jest.spyOn(mockSession, 'checkSession')
    .mockImplementationOnce(() => older.promise)
    .mockImplementationOnce(() => newer.promise);
  // The focused pregame closed-connection panel retains its visible Retry
  // while checking; these are two ordinary presses across separate renders.
  pressButton('Retry');
  expect(buttons('Retry')).toHaveLength(1);
  pressButton('Retry');
  expect(check).toHaveBeenCalledTimes(2);
  await act(async () => { newer.resolve({ kind: 'valid' }); });
  const second = mockSession.sockets[1];
  act(() => { welcome(second); pregame(second); });
  const current = store.getState();
  expect(current.session.phase).toBe('ready');
  expect(current.room.room.kind).toBe('pregame');

  await act(async () => { older.resolve({ kind: 'missing' }); });

  expect(store.getState()).toBe(current);
  expect(second.readyState).toBe(1);
  expect(tree.root.findByType(PregameScreen).props.presentationVisible).toBe(true);
  expect(buttons('Login')).toHaveLength(0);
});

test('an older pregame probe cannot undo a newer manual login', async () => {
  await act(async () => { tree = create(<Provider store={store}><App /></Provider>); });
  const first = mockSession.sockets[0];
  act(() => { welcome(first); pregame(first); first.emitClose(); });
  const older = deferred<SessionCheckResult>();
  const check = jest.spyOn(mockSession, 'checkSession')
    .mockImplementationOnce(() => older.promise)
    .mockResolvedValueOnce({ kind: 'missing' });
  pressButton('Retry');
  await act(async () => { pressButton('Retry'); });
  expect(buttons('Login')).toHaveLength(1);
  act(() => {
    tree.root.findByProps({ placeholder: 'Username', value: '' }).props.onChangeText('Bob');
    tree.root.findByProps({ placeholder: 'Password', value: '' }).props.onChangeText('test-only-placeholder');
  });
  const login = jest.spyOn(mockSession, 'submitLogin');
  await act(async () => { pressButton('Login'); });
  expect(login).toHaveBeenCalledTimes(1);
  expect(check).toHaveBeenCalledTimes(3);
  const second = mockSession.sockets[1];
  act(() => {
    second.emitOpen();
    second.emitMessage('welcome {"userID":2,"username":"Bob","totalGames":0,"playingAtTables":[]}');
    second.emitMessage('userList []');
    second.emitMessage('tableList []');
  });
  const current = store.getState();
  expect(current.session.authenticatedUser?.username).toBe('Bob');
  await act(async () => { older.resolve({ kind: 'missing' }); });
  expect(store.getState()).toBe(current);
  expect(second.readyState).toBe(1);
  expect(buttons('Login')).toHaveLength(0);
});

test('a late valid initial probe cannot reopen the socket after App unmount', async () => {
  const pending = deferred<SessionCheckResult>();
  jest.spyOn(mockSession, 'checkSession').mockImplementation(() => pending.promise);
  const open = jest.spyOn(mockSession, 'openSocket');
  await act(async () => { tree = create(<Provider store={store}><App /></Provider>); });
  act(() => tree!.unmount());
  tree = undefined;
  await act(async () => { pending.resolve({ kind: 'valid' }); });
  expect(open).not.toHaveBeenCalled();
  expect(store.getState().session.phase).toBe('closed');
});

test('an unmounted probe cannot reset a remounted App with newer realtime authority', async () => {
  const older = deferred<SessionCheckResult>();
  jest.spyOn(mockSession, 'checkSession').mockImplementationOnce(() => older.promise);
  await act(async () => { tree = create(<Provider store={store}><App /></Provider>); });
  act(() => tree!.unmount());
  await act(async () => { tree = create(<Provider store={store}><App /></Provider>); });
  const socket = mockSession.sockets[0];
  act(() => { welcome(socket); pregame(socket); });
  const current = store.getState();
  await act(async () => { older.resolve({ kind: 'missing' }); });
  expect(store.getState()).toBe(current);
  expect(socket.readyState).toBe(1);
  expect(tree.root.findByType(PregameScreen).props.presentationVisible).toBe(true);
});

test('a current App probe superseded by reconnect obtains fresh HTTP evidence exactly once', async () => {
  const older = deferred<SessionCheckResult>();
  const newer = deferred<SessionCheckResult>();
  const check = jest.spyOn(mockSession, 'checkSession')
    .mockImplementationOnce(() => older.promise)
    .mockImplementationOnce(() => newer.promise);
  const open = jest.spyOn(mockSession, 'openSocket');
  await act(async () => { tree = create(<Provider store={store}><App /></Provider>); });
  await act(async () => { await mockRuntime.connect(); });
  const socket = mockSession.sockets[0];
  act(() => welcomeLobby(socket));
  await act(async () => { older.resolve({ kind: 'missing' }); });
  expect(check).toHaveBeenCalledTimes(2);
  expect(store.getState().session.phase).toBe('ready');
  await act(async () => { newer.resolve({ kind: 'valid' }); });
  expect(check).toHaveBeenCalledTimes(2);
  expect(open).toHaveBeenCalledTimes(1);
  expect(buttons('More')).toHaveLength(1);
  expect(socket.readyState).toBe(1);
});

test.each(['HTTP login', 'credential save'] as const)(
  'unmount during %s prevents later verification or reconnect', async (stage) => {
    jest.spyOn(mockSession, 'checkSession').mockResolvedValueOnce({ kind: 'missing' });
    const submit = deferred<void>();
    const save = deferred<Awaited<ReturnType<typeof credentialAccounts.savePasswordCredential>>>();
    const login = jest.spyOn(mockSession, 'submitLogin');
    if (stage === 'HTTP login') login.mockImplementation(() => submit.promise);
    else jest.spyOn(credentialAccounts, 'savePasswordCredential').mockImplementation(() => save.promise);
    const check = jest.spyOn(mockSession, 'checkSession');
    const open = jest.spyOn(mockSession, 'openSocket');
    await act(async () => { tree = create(<Provider store={store}><App /></Provider>); });
    act(() => {
      tree.root.findByProps({ placeholder: 'Username', value: '' }).props.onChangeText('Ada');
      tree.root.findByProps({ placeholder: 'Password', value: '' }).props.onChangeText('test-only-placeholder');
    });
    await act(async () => { pressButton('Login'); });
    expect(login).toHaveBeenCalledTimes(1);
    const before = check.mock.calls.length;
    act(() => tree!.unmount());
    tree = undefined;
    await act(async () => { submit.resolve(); save.resolve({ kind: 'unavailable' }); });
    expect(check).toHaveBeenCalledTimes(before);
    expect(open).not.toHaveBeenCalled();
  },
);

test('unmount while choosing a recent account prevents obsolete credentials starting login', async () => {
  jest.spyOn(mockSession, 'checkSession').mockResolvedValue({ kind: 'missing' });
  jest.spyOn(credentialAccounts, 'listRecentAccounts').mockResolvedValue(['Ada']);
  const credentials = deferred<Awaited<ReturnType<typeof credentialAccounts.getPasswordCredential>>>();
  jest.spyOn(credentialAccounts, 'getPasswordCredential').mockImplementation(() => credentials.promise);
  const login = jest.spyOn(mockSession, 'submitLogin');
  await act(async () => { tree = create(<Provider store={store}><App /></Provider>); });
  pressButton('Ada');
  act(() => tree!.unmount());
  tree = undefined;
  await act(async () => {
    credentials.resolve({ kind: 'credential', username: 'Ada', password: 'test-only-placeholder' });
  });
  expect(login).not.toHaveBeenCalled();
});

test.each(['logout completion', 'logout verification'] as const)(
  'unmount during %s protects a remounted App from obsolete sign-out followups', async (stage) => {
    await act(async () => { tree = create(<Provider store={store}><App /></Provider>); });
    act(() => welcomeLobby(mockSession.sockets[0]));
    const logout = deferred<void>();
    const verification = deferred<SessionCheckResult>();
    const check = jest.spyOn(mockSession, 'checkSession');
    const submit = jest.spyOn(mockSession, 'logout');
    if (stage === 'logout completion') submit.mockImplementation(() => logout.promise);
    else check.mockImplementationOnce(() => verification.promise);
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    pressButton('More');
    pressButton('Settings');
    pressButton('Account & security');
    pressButton('Sign out');
    const confirm = alert.mock.calls.at(-1)?.[2]?.find((button) => button.text === 'Sign out')?.onPress;
    expect(confirm).toBeDefined();
    await act(async () => { confirm!(); });
    expect(submit).toHaveBeenCalledTimes(1);
    act(() => tree!.unmount());
    await act(async () => { tree = create(<Provider store={store}><App /></Provider>); });
    const second = mockSession.sockets[1];
    act(() => { welcome(second); pregame(second); });
    const current = store.getState();
    const calls = check.mock.calls.length;

    await act(async () => { logout.resolve(); verification.resolve({ kind: 'missing' }); });

    expect(check).toHaveBeenCalledTimes(calls);
    expect(store.getState()).toBe(current);
    expect(second.readyState).toBe(1);
    expect(tree.root.findByType(PregameScreen).props.presentationVisible).toBe(true);
  },
);

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

function terminalBootstrapRetry() {
  expect(store.getState().session.phase).toBe('ready');
  expect(store.getState().room.room).toMatchObject({
    kind: 'awaiting_game_bootstrap', bootstrap: { phase: 'failed' },
  });
  expect(tree.root.findAllByType(C17GameScreen)).toHaveLength(0);
  const alert = tree.root.findAllByType(View).find((node: { props: { accessibilityRole?: string } }) =>
    node.props.accessibilityRole === 'alert');
  expect(alert).toBeDefined();
  expect(alert.findAllByType(Text).map((node: { props: { children: unknown } }) => node.props.children))
    .toContain('Unable to load game');
  expect(tree.root.findAllByType(Text).some((node: { props: { children: unknown } }) =>
    node.props.children === 'Loading game…')).toBe(false);
  expect(buttons('Retry')).toHaveLength(1);
  const controls = buttons('Retry')[0].findAllByProps({
    accessibilityRole: 'button', accessibilityLabel: 'Retry loading game',
  });
  expect(controls.length).toBeGreaterThan(0);
  const retry = controls[0];
  expect(retry.props).toMatchObject({
    accessibilityRole: 'button', accessibilityLabel: 'Retry loading game', disabled: false,
  });
  return retry;
}

test('terminal bootstrap error Retry reconnects the mounted App and recovers only from fresh authority, ignoring stale callbacks and the old Play', async () => {
  const openSocket = jest.spyOn(mockSession, 'openSocket');
  const first = await mountLive();
  const oldConnectionEpoch = store.getState().session.connectionEpoch;
  selectCard(0);
  pressButton('Play');
  expect(store.getState().room.pendingGameplayAction).not.toBeNull();
  expect(first.sent.at(-1)).toBe('action {"tableID":123,"type":0,"target":0}');

  // Let the real coordinator's history watchdog fail a new authoritative load.
  // Capture callbacks so disposal alone cannot make the stale-event check pass.
  const timers = jest.spyOn(globalThis, 'setTimeout');
  let staleWatchdogs: Array<() => void>;
  try {
    act(() => first.emitMessage('tableStart {"tableID":123,"replay":false}'));
    act(() => first.emitMessage(`init ${JSON.stringify(makeInit())}`));
    staleWatchdogs = timers.mock.calls.filter(([, delay]) => delay === 15_000)
      .map(([callback]) => callback as () => void);
    expect(staleWatchdogs).toHaveLength(2);
  } finally {
    timers.mockRestore();
  }
  const staleMessages = first.snapshotMessages();
  expect(staleMessages.length).toBeGreaterThan(0);
  expect(store.getState().room.room).toMatchObject({ bootstrap: { phase: 'waiting_history' } });
  expect(tree.root.findByType(GameBootstrapStatus)).toBeDefined();
  expect(buttons('Retry')).toHaveLength(0);
  act(() => jest.advanceTimersByTime(15_000));
  const retry = terminalBootstrapRetry();
  const failedRoom = store.getState().room.room;
  const sentBeforeRetry = [...first.sent];
  expect(first.readyState).toBe(1);
  act(() => jest.advanceTimersByTime(60_000));
  expect(store.getState().room.room).toBe(failedRoom);
  expect(openSocket).toHaveBeenCalledTimes(1);
  expect(first.sent).toEqual(sentBeforeRetry);

  // Use the rendered accessible control, without calling the recovery API here.
  act(() => retry.props.onPress());
  expect(store.getState().session.phase).toBe('connecting');
  expect(store.getState().session.connectionEpoch).toBeGreaterThan(oldConnectionEpoch);
  expect(store.getState().room.room).toEqual({ kind: 'none' });
  expect(first.readyState).toBe(3);
  expect(first.snapshotMessages()).toHaveLength(0);
  await act(async () => {});
  const second = mockSession.sockets[1];
  expect(openSocket).toHaveBeenCalledTimes(2);
  act(() => second.emitOpen());
  expect(store.getState().session.phase).toBe('openAwaitingWelcome');
  expect(second.sent).toEqual([]);
  expect(tree.root.findAllByType(C17GameScreen)).toHaveLength(0);

  act(() => {
    second.emitMessage('welcome {"userID":1,"username":"Ada","totalGames":0,"playingAtTables":[123]}');
    second.emitMessage('userList []');
    second.emitMessage('tableList []');
  });
  expect(store.getState().session.phase).toBe('ready');
  expect(store.getState().room.pendingRecovery).toEqual({ tableID: 123, role: 'player' });
  expect(second.sent).toEqual(['tableReattend {"tableID":123}']);
  act(() => second.emitMessage('tableStart {"tableID":123,"replay":false}'));
  act(() => second.emitMessage(`init ${JSON.stringify(makeInit())}`));
  expect(store.getState().room.room).toMatchObject({ bootstrap: { phase: 'waiting_history' } });
  expect(tree.root.findAllByType(C17GameScreen)).toHaveLength(0);

  function deliverStaleCallbacks() {
    act(() => {
      for (const callback of staleWatchdogs) callback();
      for (const data of [
        'welcome {"userID":1,"username":"Ada","totalGames":0,"playingAtTables":[999]}',
        'tableStart {"tableID":123,"replay":false}',
        `init ${JSON.stringify(makeInit())}`,
        `gameActionList ${JSON.stringify(history())}`,
        'gameAction {"tableID":123,"action":{"type":"turn","num":99,"currentPlayerIndex":1}}',
      ]) {
        for (const callback of staleMessages) callback({ data } as WebSocketMessageEvent);
      }
    });
  }
  const recoveringState = store.getState();
  const recoveringFrames = [...second.sent];
  deliverStaleCallbacks();
  expect(store.getState()).toBe(recoveringState);
  expect(second.sent).toEqual(recoveringFrames);
  expect(tree.root.findAllByType(C17GameScreen)).toHaveLength(0);

  act(() => second.emitMessage(`gameActionList ${JSON.stringify(history())}`));
  expect(liveRoom()).toMatchObject({
    tableID: 123, role: 'player', clientState: { ongoingGame: { turn: { currentPlayerIndex: 0 } } },
  });
  expect(failedRoom.kind).toBe('awaiting_game_bootstrap');
  if (failedRoom.kind !== 'awaiting_game_bootstrap' || failedRoom.bootstrap === 'pending_c5') {
    throw new Error('Expected a failed bootstrap generation');
  }
  expect(liveRoom().gameLoadEpoch).toBeGreaterThan(failedRoom.bootstrap.gameLoadEpoch);
  expect(store.getState().room.connectionEpoch).toBe(store.getState().session.connectionEpoch);
  expect(store.getState().room.pendingGameplayAction).toBeNull();
  expect(tree.root.findByType(C17GameScreen).props.presentationVisible).toBe(true);
  expect(tree.root.findAllByType(GameBootstrapStatus)).toHaveLength(0);
  expectDisarmed();
  const recoveredState = store.getState();
  deliverStaleCallbacks();
  act(() => jest.advanceTimersByTime(60_000));
  expect(store.getState()).toBe(recoveredState);
  expect(openSocket).toHaveBeenCalledTimes(2);
  expect(first.sent).toEqual(sentBeforeRetry);
  expect(first.sent.filter((frame) => frame.startsWith('action '))).toHaveLength(1);
  expect(second.sent).toEqual([
    'tableReattend {"tableID":123}', 'getGameInfo1 {"tableID":123}',
    'getGameInfo2 {"tableID":123}', 'loaded {"tableID":123}',
  ]);
});

test('failed historical replay Retry in the mounted App settles in browsing when fresh welcome has no room, without recreating the replay', async () => {
  const openSocket = jest.spyOn(mockSession, 'openSocket');
  await act(async () => { tree = create(<Provider store={store} stabilityCheck="never"><App /></Provider>); });
  const first = mockSession.sockets[0];
  const noRoomWelcome = 'welcome {"userID":1,"username":"Ada","totalGames":0,"playingAtTables":[]}';
  act(() => {
    first.emitOpen();
    first.emitMessage(noRoomWelcome);
    first.emitMessage('userList []');
    first.emitMessage('tableList []');
  });
  pressButton('History');
  pressButton('Open replay');
  const input = tree.root.findAllByType(TextInput).find((node: { props: { placeholder?: string } }) =>
    node.props.placeholder === 'Replay link or database ID');
  expect(input).toBeDefined();
  act(() => input.props.onChangeText('77'));
  pressButton('Open');
  expect(store.getState().history.pendingReplayCreate).toMatchObject({ databaseID: 77, visibility: 'solo' });
  expect(first.sent.filter((frame) => frame.startsWith('replayCreate '))).toEqual([
    'replayCreate {"source":"id","databaseID":77,"visibility":"solo"}',
  ]);
  act(() => first.emitMessage('tableStart {"tableID":123,"replay":true}'));
  act(() => jest.advanceTimersByTime(15_000));
  const retry = terminalBootstrapRetry();
  const oldEpoch = store.getState().session.connectionEpoch;
  const oldFrames = [...first.sent];
  act(() => retry.props.onPress());
  await act(async () => {});
  const second = mockSession.sockets[1];
  expect(first.readyState).toBe(3);
  expect(store.getState().session.connectionEpoch).toBeGreaterThan(oldEpoch);
  act(() => second.emitOpen());
  expect(store.getState().session.phase).toBe('openAwaitingWelcome');
  expect(second.sent).toEqual([]);
  act(() => {
    second.emitMessage(noRoomWelcome);
    second.emitMessage('userList []');
    second.emitMessage('tableList []');
  });
  expect(store.getState().session.phase).toBe('ready');
  expect(store.getState().room.room).toEqual({ kind: 'none' });
  expect(store.getState().room.pendingRecovery).toBeNull();
  expect(store.getState().history.pendingReplayCreate).toBeNull();
  expect(tree.root.findAllByType(GameBootstrapStatus)).toHaveLength(0);
  expect(tree.root.findAllByType(C17GameScreen)).toHaveLength(0);
  expect(buttons('Retry')).toHaveLength(0);
  expect(tree.root.findByType(BrowsingNavigation)).toBeDefined();
  expect(tree.root.findByType(BrowsingAppBar).props.returnPresentation).toBeNull();
  const readyRoom = store.getState().room;
  act(() => {
    // A late replay transition has no current authoritative entry path.
    second.emitMessage('tableStart {"tableID":123,"replay":true}');
    jest.advanceTimersByTime(60_000);
  });
  expect(store.getState().room).toBe(readyRoom);
  expect(openSocket).toHaveBeenCalledTimes(2);
  expect(first.sent).toEqual(oldFrames);
  expect(second.sent).toEqual([]);
});

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
  pressButton('Home');
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
