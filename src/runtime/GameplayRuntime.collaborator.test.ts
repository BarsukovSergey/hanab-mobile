import { describe, expect, jest, test } from '@jest/globals';

import { GameBootstrapCoordinator } from '../game/bootstrap/GameBootstrapCoordinator';
import { gameActionListSchema, gameInitSchema, noteSchema } from '../protocol/gameProtocol';
import { makeInit } from '../protocol/gameProtocol.fixtures';
import { roomActions } from '../store/roomSlice';
import { sessionActions } from '../store/sessionSlice';
import { createAppStore } from '../store/store';
import { GameplayRuntime } from './GameplayRuntime';

function makeRuntime(options: {
  spectator?: boolean; currentPlayerIndex?: number; paused?: boolean;
} = {}) {
  const store = createAppStore();
  store.dispatch(sessionActions.connectionStarted({ epoch: 1 }));
  store.dispatch(sessionActions.welcomeReceived({
    epoch: 1, welcome: { userID: 1, username: 'Ada', totalGames: 0, playingAtTables: [] },
  }));
  if (options.spectator) store.dispatch(roomActions.spectateRequested({ epoch: 1, tableID: 123 }));
  else store.dispatch(roomActions.joinRequested({ epoch: 1, tableID: 123 }));
  store.dispatch(roomActions.tableStartReceived({ epoch: 1, tableStart: { tableID: 123, replay: false } }));
  const currentPlayerIndex = options.currentPlayerIndex ?? 0;
  const startingPlayer = (currentPlayerIndex + 1) % 2;
  const bootstrap = new GameBootstrapCoordinator(store, () => true);
  const loadEpoch = bootstrap.startFromAuthoritativeRoom(1)!;
  bootstrap.receiveInit(1, loadEpoch, gameInitSchema.parse(makeInit({
    spectating: options.spectator ?? false,
    paused: options.paused ?? false,
    pausePlayerIndex: options.paused ? 0 : -1,
    options: { ...makeInit().options, timed: true, timeBase: 120, timePerTurn: 20, startingPlayer },
  })));
  bootstrap.receiveHistory(1, loadEpoch, gameActionListSchema.parse({
    tableID: 123,
    list: [
      ...Array.from({ length: 5 }, (_, order) => ({
        type: 'draw', playerIndex: 0, order, suitIndex: -1, rank: -1,
      })),
      ...Array.from({ length: 5 }, (_, index) => ({
        type: 'draw', playerIndex: 1, order: index + 5, suitIndex: index, rank: index + 1,
      })),
      { type: 'clue', clue: { type: 0, value: 0 }, giver: startingPlayer,
        list: currentPlayerIndex === 0 ? [0] : [5], target: currentPlayerIndex, turn: 0 },
      { type: 'status', clues: 7, score: 0, maxScore: 25 },
      { type: 'turn', num: 1, currentPlayerIndex },
    ],
  }));
  const send = jest.fn<(frame: string) => boolean>().mockReturnValue(true);
  const ready = jest.fn<(tableID: number) => boolean>().mockReturnValue(true);
  const runtime = new GameplayRuntime(store, send, ready);
  const room = () => {
    const current = store.getState().room.room;
    if (current.kind !== 'live_game') throw new Error('Expected live game');
    return current;
  };
  return { store, runtime, send, ready, room };
}

describe('GameplayRuntime collaborator', () => {
  test.each<{ name: string; command: (runtime: GameplayRuntime) => boolean; frame: string }>([
    { name: 'play', command: (runtime) => runtime.play(0), frame: 'action {"tableID":123,"type":0,"target":0}' },
    { name: 'discard', command: (runtime) => runtime.discard(0), frame: 'action {"tableID":123,"type":1,"target":0}' },
    { name: 'color clue', command: (runtime) => runtime.colorClue(1, 0), frame: 'action {"tableID":123,"type":2,"target":1,"value":0}' },
    { name: 'rank clue', command: (runtime) => runtime.rankClue(1, 3), frame: 'action {"tableID":123,"type":3,"target":1,"value":3}' },
  ])('$name sends once without changing authoritative GameState', ({ command, frame }) => {
    const { runtime, store, send, ready, room } = makeRuntime();
    const before = room();
    expect(command(runtime)).toBe(true);
    expect(command(runtime)).toBe(false);
    expect(send.mock.calls).toEqual([[frame]]);
    expect(ready).toHaveBeenCalledWith(123);
    expect(room()).toBe(before);
    expect(store.getState().room.pendingGameplayAction).toMatchObject({
      connectionEpoch: 1, tableID: 123, gameLoadEpoch: before.gameLoadEpoch,
    });
  });

  test('current-room readiness gates every command before sending or changing state', () => {
    const { runtime, store, send, ready, room } = makeRuntime();
    const before = room();
    ready.mockReturnValue(false);
    expect(runtime.play(0)).toBe(false);
    expect(runtime.discard(0)).toBe(false);
    expect(runtime.colorClue(1, 0)).toBe(false);
    expect(runtime.rankClue(1, 3)).toBe(false);
    expect(runtime.pauseGame()).toBe(false);
    expect(runtime.editNote(0, 'r1')).toBe(false);
    expect(ready.mock.calls).toEqual(Array.from({ length: 6 }, () => [123]));
    expect(send).not.toHaveBeenCalled();
    expect(room()).toBe(before);
    expect(store.getState().room.pendingGameplayAction).toBeNull();
  });

  test.each(['spectator', 'other turn', 'paused', 'review'] as const)(
    '%s blocks live gameplay even with a ready sender', (mode) => {
      const { runtime, send, store, room } = makeRuntime({
        spectator: mode === 'spectator', currentPlayerIndex: mode === 'other turn' ? 1 : 0,
        paused: mode === 'paused',
      });
      if (mode === 'review') store.dispatch(roomActions.reviewSegmentSelected({
        tableID: 123, gameLoadEpoch: room().gameLoadEpoch, segment: 0,
      }));
      expect(runtime.play(0)).toBe(false);
      expect(runtime.discard(0)).toBe(false);
      expect(runtime.colorClue(1, 0)).toBe(false);
      expect(runtime.rankClue(1, 3)).toBe(false);
      expect(send).not.toHaveBeenCalled();
      expect(store.getState().room.pendingGameplayAction).toBeNull();
    },
  );

  test.each(['false', 'throw'] as const)('send returning %s clears newly-created pending intent', (failure) => {
    const { runtime, send, store, room } = makeRuntime();
    const before = room();
    send.mockImplementationOnce(() => {
      expect(store.getState().room.pendingGameplayAction?.action).toEqual({ tableID: 123, type: 0, target: 0 });
      if (failure === 'throw') throw new Error('send failed');
      return false;
    });
    expect(runtime.play(0)).toBe(false);
    expect(store.getState().room.pendingGameplayAction).toBeNull();
    expect(room()).toBe(before);
    expect(runtime.play(1)).toBe(true);
    expect(store.getState().room.pendingGameplayAction?.action).toEqual({ tableID: 123, type: 0, target: 1 });
    expect(send).toHaveBeenCalledTimes(2);
  });

  test('pending cleanup ignores another epoch and permits the next command only after clearing', () => {
    const { runtime, store, send } = makeRuntime();
    expect(runtime.play(0)).toBe(true);
    const pending = store.getState().room.pendingGameplayAction;
    runtime.clearCurrentPending(2);
    expect(store.getState().room.pendingGameplayAction).toBe(pending);
    expect(runtime.rankClue(1, 3)).toBe(false);
    runtime.clearCurrentPending(1);
    expect(store.getState().room.pendingGameplayAction).toBeNull();
    runtime.clearCurrentPending(1);
    expect(runtime.rankClue(1, 3)).toBe(true);
    expect(send).toHaveBeenCalledTimes(2);
  });

  test.each(['false', 'throw'] as const)('pause queue changes only after successful sends (failure=%s)', (failure) => {
    const { runtime, send, room } = makeRuntime({ currentPlayerIndex: 1 });
    const fail = () => {
      if (failure === 'throw') throw new Error('send failed');
      return false;
    };
    send.mockImplementationOnce(fail);
    expect(runtime.pauseGame()).toBe(false);
    expect(room().clientState.pause.queued).toBe(false);
    expect(runtime.pauseGame()).toBe(true);
    expect(send).toHaveBeenLastCalledWith('pause {"tableID":123,"setting":"pause-queue"}');
    expect(room().clientState.pause.queued).toBe(true);
    send.mockImplementationOnce(fail);
    expect(runtime.pauseGame()).toBe(false);
    expect(room().clientState.pause.queued).toBe(true);
    expect(runtime.pauseGame()).toBe(true);
    expect(send).toHaveBeenLastCalledWith('pause {"tableID":123,"setting":"pause-unqueue"}');
    expect(room().clientState.pause.queued).toBe(false);
  });

  test.each(['false', 'throw'] as const)('notes retain validation, the 300-character limit, and send-before-edit (failure=%s)', (failure) => {
    const { runtime, send, store, room } = makeRuntime();
    const before = room();
    for (const order of [-1, 0.5, before.clientState.notes.ourNotes.length, NaN]) {
      expect(runtime.editNote(order, 'r1')).toBe(false);
    }
    expect(runtime.editNote(0, 'x'.repeat(301))).toBe(false);
    expect(send).not.toHaveBeenCalled();
    send.mockImplementationOnce(() => {
      if (failure === 'throw') throw new Error('send failed');
      return false;
    });
    expect(runtime.editNote(0, 'r1')).toBe(false);
    expect(room()).toBe(before);
    expect(runtime.editNote(0, 'x'.repeat(300))).toBe(true);
    expect(room().clientState.notes.ourNotes[0]?.text).toBe('x'.repeat(300));
    expect(runtime.editNote(0, '')).toBe(true);
    expect(send).toHaveBeenLastCalledWith('note {"tableID":123,"order":0,"note":""}');
    expect(room().clientState.notes.ourNotes[0]?.text).toBe('');
    expect(room().clientState.ongoingGame.hands).toBe(before.clientState.ongoingGame.hands);
    expect(room().clientState.ongoingGame.turn).toBe(before.clientState.ongoingGame.turn);
    expect(room().clientState.replay.actions).toBe(before.clientState.replay.actions);
    expect(store.getState().room.pendingGameplayAction).toBeNull();
  });

  test('inbound note events keep reducer guards and do not require an outgoing send path', () => {
    const { runtime, ready, send, room } = makeRuntime();
    ready.mockReturnValue(false);
    const before = room();
    runtime.receiveEvent(0, { command: 'noteListPlayer', data: { tableID: 123, notes: ['stale'] } });
    runtime.receiveEvent(1, { command: 'noteListPlayer', data: { tableID: 999, notes: ['wrong'] } });
    expect(room()).toBe(before);
    runtime.receiveEvent(1, { command: 'noteListPlayer', data: { tableID: 123, notes: ['r1'] } });
    expect(room().clientState.notes.ourNotes[0]?.text).toBe('r1');
    runtime.receiveEvent(1, { command: 'noteList', data: {
      tableID: 123, notes: [{ name: 'Bob', notes: ['kt'], isSpectator: false }],
    } });
    expect(room().clientState.notes.allNotes[0]).toEqual([{ name: 'Bob', text: 'kt', isSpectator: false }]);
    runtime.receiveEvent(1, { command: 'note', data: noteSchema.parse({
      tableID: 123, order: 0, notes: [{ name: 'Ada', text: 'r2', isSpectator: true }],
    }) });
    expect(room().clientState.notes.allNotes[0]).toEqual([{ name: 'Ada', text: 'r2', isSpectator: true }]);
    expect(room().clientState.ongoingGame.hands).toBe(before.clientState.ongoingGame.hands);
    expect(room().clientState.ongoingGame.turn).toBe(before.clientState.ongoingGame.turn);
    expect(send).not.toHaveBeenCalled();
    expect(ready).not.toHaveBeenCalled();
  });
});
