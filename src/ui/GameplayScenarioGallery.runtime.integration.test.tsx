import React from 'react';
import { AppState } from 'react-native';
import { Provider } from 'react-redux';
import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';

import { lobbyRuntime, networkSession } from '../runtime/application';
import { store } from '../store/store';
import { ActionButton, HanabThemeProvider, ResponsiveSurfaceProvider } from './designSystem';
import { ClueComposer } from './game/ClueComposer';
import { GameCard } from './game/GameCard';
import { SideClueEntry } from './game/SideClueEntry';
import { getSideClueSize } from './game/sideClueLayout';
import { GameScreen } from './game/GameScreen';
import { GameplayScenarioGallery } from './game/scenarios/GameplayScenarioGallery';
import { getGameplayGalleryScenarios } from './game/scenarios/gameplayScenarios';
import { bootstrap, FakeSession, welcome } from './testUtils/appRuntimeHarness';

const { act, create } = require('react-test-renderer');

jest.mock('react-redux', () => require('../../node_modules/react-redux/dist/cjs/react-redux.development.cjs'));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);

// Keep application.ts, its command gate, singleton store, and all collaborators
// real. Replace only platform networking; no test can open a production socket.
jest.mock('../network/NetworkSession', () => ({
  HanabNetworkSession: require('./testUtils/appRuntimeHarness').FakeSession,
}));

let tree: ReturnType<typeof create> | undefined;
const session = networkSession as unknown as FakeSession;
let nextSocket = 0;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  jest.useFakeTimers();
  Object.defineProperty(AppState, 'currentState', { configurable: true, value: 'active' });
});

afterEach(() => {
  unmountGallery();
  lobbyRuntime.disconnect();
  jest.useRealTimers();
});

jest.setTimeout(30_000);

async function readyProductionRoom(sharedReview = false) {
  expect(networkSession).toBeInstanceOf(FakeSession);
  await lobbyRuntime.connect();
  const socket = session.sockets[nextSocket++];
  if (socket === undefined) throw new Error('Unexpected socket attempt');
  welcome(socket);
  bootstrap(socket, 123, sharedReview);
  expect(store.getState().session.phase).toBe('ready');
  expect(store.getState().room.room).toMatchObject({ kind: 'live_game', tableID: 123 });
  return socket;
}

function mountGallery() {
  act(() => {
    tree = create(<HanabThemeProvider><ResponsiveSurfaceProvider><Provider store={store} stabilityCheck="never">
      <GameplayScenarioGallery onBack={unmountGallery} />
    </Provider></ResponsiveSurfaceProvider></HanabThemeProvider>);
  });
  expect(tree.root.findAllByType(GameScreen)).toHaveLength(1);
  const providers = tree.root.findAllByType(Provider);
  expect(providers).toHaveLength(2);
  expect(providers[0].props.store).toBe(store);
  expect(providers[1].props.store).toBe(getGameplayGalleryScenarios()[0]?.store);
  expect(providers[1].props.store).not.toBe(store);
  return providers[1].props.store;
}

function unmountGallery() {
  if (tree) act(() => tree.unmount());
  tree = undefined;
}

function press(title: string) {
  const matches = tree.root.findAllByType(ActionButton)
    .filter((node: { props: { title: string } }) => node.props.title === title);
  expect(matches).toHaveLength(1);
  expect(matches[0].props.disabled).not.toBe(true);
  act(() => matches[0].props.onPress());
}

test('gallery isolates its store and blocks eligible gameplay commands through the real application gate until unmount', async () => {
  const socket = await readyProductionRoom();
  // Two authoritative clues return the turn to Ada below maximum tokens, so
  // Play, Discard, and both clue commands are all eligible before suppression.
  socket.emitMessage('gameAction {"tableID":123,"action":{"type":"clue","clue":{"type":1,"value":1},"giver":0,"list":[5],"target":1,"turn":0}}');
  socket.emitMessage('gameAction {"tableID":123,"action":{"type":"clue","clue":{"type":1,"value":1},"giver":1,"list":[0],"target":0,"turn":1}}');
  expect(store.getState().room.room).toMatchObject({
    clientState: { ongoingGame: { clueTokens: 6, turn: { currentPlayerIndex: 0 } } },
  });
  const commands = [
    { run: () => lobbyRuntime.play(0), frame: 'action {"tableID":123,"type":0,"target":0}' },
    { run: () => lobbyRuntime.discard(0), frame: 'action {"tableID":123,"type":1,"target":0}' },
    { run: () => lobbyRuntime.colorClue(1, 0), frame: 'action {"tableID":123,"type":2,"target":1,"value":0}' },
    { run: () => lobbyRuntime.rankClue(1, 1), frame: 'action {"tableID":123,"type":3,"target":1,"value":1}' },
    { run: () => lobbyRuntime.editNote(0, 'gallery isolation'), frame: 'note {"tableID":123,"order":0,"note":"gallery isolation"}' },
  ];
  const beforeMount = store.getState();
  const beforeFrames = [...socket.sent];
  const scenarioStore = mountGallery();
  expect(store.getState()).toBe(beforeMount);
  const scenarioState = scenarioStore.getState();

  // Exercise real GameScreen handlers, including explicit enabled commits.
  const ownCard = tree.root.findAllByType(GameCard)
    .find((node: { props: { knowledge: { order: number } } }) => node.props.knowledge.order === 0);
  expect(ownCard).toBeDefined();
  act(() => ownCard.props.onSelect());
  press('Play');
  const measure = (testID: string, width: number, height: number) => {
    const node = tree.root.findAllByProps({ testID }).find((candidate: any) => typeof candidate.props.onLayout === 'function');
    expect(node).toBeDefined();
    act(() => node.props.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width, height } } }));
  };
  measure('c17-portrait-body', 370, 650);
  const entry = tree.root.findAllByType(SideClueEntry).find((node: any) => node.props.playerName === 'Bob');
  const size = getSideClueSize(entry.props.fontScale);
  measure('clue-entry-Bob', size.width, size.height);
  measure('clue-entry-text-Bob', 28, size.lineHeight);
  const target = tree.root.findAllByProps({ testID: 'clue-entry-Bob' }).find((node: any) => typeof node.props.onPress === 'function');
  expect(target.props.disabled).toBe(false);
  act(() => { target.props.onPressIn({ stopPropagation() {} }); target.props.onPress({ stopPropagation() {} }); });
  act(() => tree.root.findByType(ClueComposer).props.onPreview('rank', 1));
  expect(tree.root.findByType(ClueComposer).props.previewState).toEqual({ type: 'rank', value: 1 });
  press('Give clue');

  for (const command of commands) expect(command.run()).toBe(false);
  // Local Rewind would mutate the production store even without a socket frame.
  expect(lobbyRuntime.navigateReplaySegment(0)).toBe(false);
  expect(socket.sent).toEqual(beforeFrames);
  expect(store.getState()).toBe(beforeMount);
  expect(scenarioStore.getState()).toBe(scenarioState);

  // Inbound authority continues through the raw runtime while commands are gated.
  act(() => socket.emitMessage('noteListPlayer {"tableID":123,"notes":["authoritative update during gallery"]}'));
  expect(store.getState().room.room).toMatchObject({
    clientState: { notes: { ourNotes: expect.arrayContaining([
      expect.objectContaining({ text: 'authoritative update during gallery' }),
    ]) } },
  });
  expect(scenarioStore.getState()).toBe(scenarioState);
  expect(socket.sent).toEqual(beforeFrames);

  // Back runs the real gallery lifecycle cleanup; nothing is queued for release.
  press('Back');
  expect(socket.sent).toEqual(beforeFrames);
  for (const [index, command] of commands.entries()) {
    const before = socket.sent.length;
    expect(command.run()).toBe(true);
    expect(socket.sent.slice(before)).toEqual([command.frame]);
    socket.emitMessage(`gameAction ${JSON.stringify({ tableID: 123, action: {
      type: 'turn', num: index + 3, currentPlayerIndex: 0,
    } })}`);
  }
  // A second mount acquires a fresh lease and its unmount releases it again.
  const beforeRemount = [...socket.sent];
  mountGallery();
  expect(lobbyRuntime.editNote(0, 'remount')).toBe(false);
  expect(socket.sent).toEqual(beforeRemount);
  unmountGallery();
  expect(socket.sent).toEqual(beforeRemount);
  expect(lobbyRuntime.editNote(0, 'remount')).toBe(true);
  expect(socket.sent.slice(beforeRemount.length)).toEqual(['note {"tableID":123,"order":0,"note":"remount"}']);
});

test('finished gallery replay handlers cannot send to a ready production shared replay and unmount restores commands', async () => {
  const socket = await readyProductionRoom(true);
  socket.emitMessage('replayLeader {"tableID":123,"name":"Ada"}');
  socket.emitMessage(`spectators ${JSON.stringify({ tableID: 123, spectators: ['Ada', 'Bob'].map((name) => ({
    name, shadowingPlayerIndex: -1, shadowingPlayerUsername: '',
  })) })}`);
  expect(lobbyRuntime.navigateReplaySegment(0)).toBe(true);
  expect(socket.sent.at(-1)).toBe('replayAction {"tableID":123,"type":0,"segment":0}');
  const before = store.getState();
  const beforeFrames = [...socket.sent];
  mountGallery();
  const finished = getGameplayGalleryScenarios().find((scenario) => scenario.id === 'finished-shared-replay');
  if (finished === undefined) throw new Error('Missing finished gallery scenario');
  press(finished.title);
  expect(tree.root.findAllByType(Provider)[1].props.store).toBe(finished.store);
  const scenarioState = finished.store.getState();
  press('Start Hypothetical');
  expect(lobbyRuntime.navigateReplaySegment(0)).toBe(false);
  expect(lobbyRuntime.startHypothetical()).toBe(false);
  expect(lobbyRuntime.quickRematch()).toBe(false);
  expect(lobbyRuntime.restartToPregame()).toBe(false);
  expect(socket.sent).toEqual(beforeFrames);
  expect(store.getState()).toBe(before);
  expect(finished.store.getState()).toBe(scenarioState);

  unmountGallery();
  expect(socket.sent).toEqual(beforeFrames);
  expect(lobbyRuntime.navigateReplaySegment(0)).toBe(true);
  expect(lobbyRuntime.startHypothetical()).toBe(true);
  expect(lobbyRuntime.quickRematch()).toBe(true);
  expect(socket.sent.slice(beforeFrames.length)).toEqual([
    'replayAction {"tableID":123,"type":0,"segment":0}',
    'replayAction {"tableID":123,"type":3}',
    'tableRestart {"tableID":123,"hidePregame":true}',
  ]);
});
