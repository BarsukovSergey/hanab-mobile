import { describe, expect, test } from '@jest/globals';

import type {
  NetworkSession,
  NetworkSocket,
  SessionCheckResult,
} from '../network/types';
import { makeInit } from '../protocol/gameProtocol.fixtures';
import { lobbyActions } from '../store/lobbySlice';
import { roomActions } from '../store/roomSlice';
import { createAppStore } from '../store/store';
import { LobbyRuntime } from './LobbyRuntime';

type MessageListener = (event: WebSocketMessageEvent) => void;

class FakeSocket implements NetworkSocket {
  readyState = 0;
  readonly sent: string[] = [];
  private readonly openListeners = new Set<() => void>();
  private readonly messageListeners = new Set<MessageListener>();
  private readonly errorListeners = new Set<() => void>();
  private readonly closeListeners = new Set<(event: WebSocketCloseEvent) => void>();

  addEventListener(type: 'open', listener: () => void): void;
  addEventListener(type: 'message', listener: MessageListener): void;
  addEventListener(type: 'error', listener: () => void): void;
  addEventListener(type: 'close', listener: (event: WebSocketCloseEvent) => void): void;
  addEventListener(type: string, listener: never): void {
    if (type === 'open') this.openListeners.add(listener);
    if (type === 'message') this.messageListeners.add(listener);
    if (type === 'error') this.errorListeners.add(listener);
    if (type === 'close') this.closeListeners.add(listener);
  }

  removeEventListener(type: 'open', listener: () => void): void;
  removeEventListener(type: 'message', listener: MessageListener): void;
  removeEventListener(type: 'error', listener: () => void): void;
  removeEventListener(type: 'close', listener: (event: WebSocketCloseEvent) => void): void;
  removeEventListener(type: string, listener: never): void {
    if (type === 'open') this.openListeners.delete(listener);
    if (type === 'message') this.messageListeners.delete(listener);
    if (type === 'error') this.errorListeners.delete(listener);
    if (type === 'close') this.closeListeners.delete(listener);
  }

  send(data: string): void { this.sent.push(data); }
  close(): void { this.readyState = 3; }
  emitOpen(): void {
    this.readyState = 1;
    for (const listener of [...this.openListeners]) listener();
  }
  emitMessage(data: string): void {
    for (const listener of [...this.messageListeners]) {
      listener({ data } as WebSocketMessageEvent);
    }
  }
  snapshotMessages(): MessageListener[] { return [...this.messageListeners]; }
}

class FakeSession implements NetworkSession {
  readonly sockets: NetworkSocket[] = [];
  private nextSocket = 0;
  checkSession(): Promise<SessionCheckResult> { return Promise.resolve({ kind: 'valid' }); }
  submitLogin(): Promise<void> { return Promise.resolve(); }
  openSocket(): Promise<NetworkSocket> {
    const socket = this.sockets[this.nextSocket++];
    if (socket === undefined) throw new Error('Missing fake socket');
    return Promise.resolve(socket);
  }
}

const welcomeFrame = 'welcome {"userID":1,"username":"Ada","playingAtTables":[]}';
const playerTable = {
  id: 123,
  name: 'Table',
  numPlayers: 1,
  maxPlayers: 5,
  running: false,
  variant: 'No Variant',
  passwordProtected: false,
  joined: false,
  progress: 0,
  players: ['Bob'],
  sharedReplay: false,
};

function initialHistory(currentPlayerIndex = 0) {
  return {
    tableID: 123,
    list: [
      ...Array.from({ length: 5 }, (_, order) => ({
        type: 'draw', playerIndex: 0, order, suitIndex: -1, rank: -1,
      })),
      ...Array.from({ length: 5 }, (_, index) => ({
        type: 'draw', playerIndex: 1, order: index + 5, suitIndex: index, rank: index + 1,
      })),
      { type: 'status', clues: 8, score: 0, maxScore: 25 },
      { type: 'turn', num: 0, currentPlayerIndex },
    ],
  };
}

async function makeLive(role: 'player' | 'spectator' = 'player') {
  const session = new FakeSession();
  const socket = new FakeSocket();
  session.sockets.push(socket);
  const store = createAppStore();
  const runtime = new LobbyRuntime(session, store);
  await runtime.connect();
  socket.emitOpen();
  socket.emitMessage(welcomeFrame);
  store.dispatch(lobbyActions.tableReceived({
    epoch: 1,
    table: role === 'player'
      ? playerTable
      : { ...playerTable, numPlayers: 2, running: true },
  }));
  if (role === 'player') expect(runtime.join(123)).toBe(true);
  else expect(runtime.spectate(123)).toBe(true);
  socket.emitMessage('tableStart {"tableID":123,"replay":false}');
  socket.emitMessage(`init ${JSON.stringify(makeInit({ spectating: role === 'spectator' }))}`);
  socket.emitMessage(`gameActionList ${JSON.stringify(initialHistory())}`);
  expect(store.getState().room.room).toMatchObject({ kind: 'live_game', role });
  return { session, socket, store, runtime };
}

describe('C7 authoritative gameplay runtime', () => {
  test('spectator, non-LIVE, non-READY, and not-our-turn states cannot send', async () => {
    const spectator = await makeLive('spectator');
    const spectatorFrames = [...spectator.socket.sent];
    expect(spectator.runtime.play(0)).toBe(false);
    expect(spectator.runtime.colorClue(1, 0)).toBe(false);
    expect(spectator.socket.sent).toEqual(spectatorFrames);

    const session = new FakeSession();
    const socket = new FakeSocket();
    session.sockets.push(socket);
    const store = createAppStore();
    const runtime = new LobbyRuntime(session, store);
    await runtime.connect();
    socket.emitOpen();
    expect(runtime.play(0)).toBe(false);
    socket.emitMessage(welcomeFrame);
    expect(runtime.play(0)).toBe(false);

    const player = await makeLive();
    player.socket.emitMessage(
      'gameAction {"tableID":123,"action":{"type":"clue","clue":{"type":0,"value":0},"giver":0,"list":[5],"target":1,"turn":0}}',
    );
    const playerFrames = [...player.socket.sent];
    expect(player.runtime.discard(0)).toBe(false);
    expect(player.socket.sent).toEqual(playerFrames);
  });

  test('invalid hand, player, color, and rank targets are rejected structurally', async () => {
    const { runtime, socket } = await makeLive();
    const before = [...socket.sent];
    expect(runtime.play(10)).toBe(false);
    expect(runtime.discard(65)).toBe(false);
    expect(runtime.colorClue(0, 0)).toBe(false);
    expect(runtime.colorClue(2, 0)).toBe(false);
    expect(runtime.colorClue(1, 5)).toBe(false);
    expect(runtime.rankClue(1, 6)).toBe(false);
    expect(socket.sent).toEqual(before);
  });

  test('send is one-shot while pending and does not optimistically mutate GameState', async () => {
    const { runtime, socket, store } = await makeLive();
    const roomBefore = store.getState().room.room;
    if (roomBefore.kind !== 'live_game') throw new Error('Expected LIVE');
    const gameBefore = roomBefore.game;
    const sentBefore = socket.sent.length;

    expect(runtime.play(0)).toBe(true);
    expect(runtime.play(0)).toBe(false);
    expect(runtime.discard(1)).toBe(false);
    expect(socket.sent.slice(sentBefore)).toEqual([
      'action {"tableID":123,"type":0,"target":0}',
    ]);
    const roomAfter = store.getState().room.room;
    if (roomAfter.kind !== 'live_game') throw new Error('Expected LIVE');
    expect(roomAfter.game).toBe(gameBefore);
    expect(store.getState().room.pendingGameplayAction).toMatchObject({
      connectionEpoch: 1,
      tableID: 123,
      gameLoadEpoch: 1,
      action: { type: 0, target: 0 },
    });
  });

  test('player LIVE actions reduce authoritatively and accepted turn settles pending', async () => {
    const { runtime, socket, store } = await makeLive();
    expect(runtime.discard(0)).toBe(true);
    socket.emitMessage(
      'gameAction {"tableID":123,"action":{"type":"clue","clue":{"type":0,"value":0},"giver":0,"list":[5],"target":1,"turn":0}}',
    );
    expect(store.getState().room.pendingGameplayAction).not.toBeNull();
    socket.emitMessage(
      'gameAction {"tableID":123,"action":{"type":"turn","num":1,"currentPlayerIndex":1}}',
    );
    const room = store.getState().room.room;
    if (room.kind !== 'live_game') throw new Error('Expected LIVE');
    expect(room.role).toBe('player');
    expect(room.liveActionCount).toBe(2);
    expect(room.game.turn.turnNum).toBe(1);
    expect(room.game.turn.currentPlayerIndex).toBe(1);
    expect(room.game.clueTokens).toBe(7);
    expect(store.getState().room.pendingGameplayAction).toBeNull();
  });

  test.each(['warning', 'error'] as const)(
    'current server %s clears pending without changing GameState',
    async (command) => {
      const { runtime, socket, store } = await makeLive();
      const before = store.getState().room.room;
      if (before.kind !== 'live_game') throw new Error('Expected LIVE');
      expect(runtime.colorClue(1, 0)).toBe(true);
      socket.emitMessage(`${command} {"${command}":"rejected"}`);
      const after = store.getState().room.room;
      if (after.kind !== 'live_game') throw new Error('Expected LIVE');
      expect(after.game).toBe(before.game);
      expect(after.liveActionCount).toBe(before.liveActionCount);
      expect(store.getState().room.pendingGameplayAction).toBeNull();
    },
  );

  test('wrong-table and wrong-load traffic cannot mutate or settle current state', async () => {
    const { runtime, socket, store } = await makeLive();
    expect(runtime.rankClue(1, 3)).toBe(true);
    const before = store.getState().room.room;
    if (before.kind !== 'live_game') throw new Error('Expected LIVE');
    socket.emitMessage(
      'gameAction {"tableID":999,"action":{"type":"turn","num":1,"currentPlayerIndex":1}}',
    );
    expect(store.getState().room.room).toBe(before);
    expect(store.getState().room.pendingGameplayAction).not.toBeNull();

    store.dispatch(roomActions.liveActionAccepted({
      connectionEpoch: 1,
      tableID: 123,
      gameLoadEpoch: 999,
      expectedLiveActionCount: 0,
      acceptedActionType: 'turn',
      game: before.game,
    }));
    expect(store.getState().room.room).toBe(before);
    expect(store.getState().room.pendingGameplayAction).not.toBeNull();
  });

  test('a new connection clears intent and never replays a gameplay command', async () => {
    const { session, runtime, socket: first, store } = await makeLive();
    expect(runtime.play(0)).toBe(true);
    const staleMessages = first.snapshotMessages();
    const second = new FakeSocket();
    session.sockets.push(second);
    runtime.disconnect();
    await runtime.connect();
    second.emitOpen();
    second.emitMessage(welcomeFrame);
    for (const listener of staleMessages) {
      listener({
        data: 'gameAction {"tableID":123,"action":{"type":"turn","num":1,"currentPlayerIndex":1}}',
      } as WebSocketMessageEvent);
    }
    expect(store.getState().room.pendingGameplayAction).toBeNull();
    expect(store.getState().room.room).toEqual({ kind: 'none' });
    expect(second.sent).toEqual([]);
  });
});
