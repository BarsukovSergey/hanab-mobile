import { describe, expect, jest, test } from '@jest/globals';

import { GameBootstrapCoordinator } from '../game/bootstrap/GameBootstrapCoordinator';
import type { ActionIncludingHypothetical } from '../game/client/types/actions';
import { gameActionListSchema, gameInitSchema } from '../protocol/gameProtocol';
import { makeInit } from '../protocol/gameProtocol.fixtures';
import { hypoActionSchema } from '../protocol/lobbyProtocol';
import { roomActions } from '../store/roomSlice';
import { sessionActions } from '../store/sessionSlice';
import { createAppStore } from '../store/store';
import { ReplayInteractionRuntime } from './ReplayInteractionRuntime';

function makeRuntime(sharedReplay = true, leader = 'Ada') {
  const store = createAppStore();
  store.dispatch(sessionActions.connectionStarted({ epoch: 1 }));
  store.dispatch(sessionActions.welcomeReceived({
    epoch: 1, welcome: { userID: 1, username: 'Ada', totalGames: 0, playingAtTables: [] },
  }));
  store.dispatch(roomActions.spectateRequested({ epoch: 1, tableID: 123 }));
  store.dispatch(roomActions.tableStartReceived({ epoch: 1, tableStart: { tableID: 123, replay: true } }));
  const bootstrap = new GameBootstrapCoordinator(store, () => true);
  const loadEpoch = bootstrap.startFromAuthoritativeRoom(1)!;
  bootstrap.receiveInit(1, loadEpoch, gameInitSchema.parse(makeInit({
    replay: true, sharedReplay, databaseID: 77, sharedReplayLeader: leader,
    sharedReplaySegment: 1, datetimeFinished: '2026-08-31T00:10:00Z',
  })));
  bootstrap.receiveHistory(1, loadEpoch, gameActionListSchema.parse({
    tableID: 123,
    list: [
      ...Array.from({ length: 5 }, (_, order) => ({ type: 'draw', playerIndex: 0, order, suitIndex: 0, rank: 1 })),
      ...Array.from({ length: 5 }, (_, index) => ({ type: 'draw', playerIndex: 1, order: index + 5, suitIndex: index, rank: index + 1 })),
      { type: 'turn', num: 0, currentPlayerIndex: 0 },
      { type: 'clue', clue: { type: 1, value: 1 }, giver: 0, list: [5], target: 1, turn: 0 },
      { type: 'turn', num: 1, currentPlayerIndex: 1 },
    ],
  }));
  store.dispatch(roomActions.spectatorsReceived({
    epoch: 1, tableID: 123,
    spectators: ['Ada', 'Bob'].map((name) => ({ name, shadowingPlayerIndex: -1, shadowingPlayerUsername: '' })),
  }));
  const send = jest.fn<(frame: string) => boolean>().mockReturnValue(true);
  const ready = jest.fn<(tableID: number) => boolean>().mockReturnValue(true);
  const diagnostic = jest.fn<(epoch: number) => void>();
  const runtime = new ReplayInteractionRuntime(store, send, ready, diagnostic);
  const room = () => {
    const current = store.getState().room.room;
    if (current.kind !== 'live_game') throw new Error('Expected active replay room');
    return current;
  };
  const replay = () => room().clientState.replay;
  const start = () => {
    expect(runtime.startHypothetical()).toBe(true);
    if (sharedReplay) runtime.receiveEvent(1, { command: 'hypoStart', data: { TableID: 123 } });
    expect(replay().hypothetical).not.toBeNull();
    send.mockClear();
  };
  const echo = (action: ActionIncludingHypothetical) => runtime.receiveEvent(1, {
    command: 'hypoAction', data: hypoActionSchema.parse(action),
  });
  const sentActions = () => send.mock.calls.map(([frame]) => {
    const payload = JSON.parse(frame.slice(frame.indexOf(' ') + 1)) as { actionJSON: string };
    return JSON.parse(payload.actionJSON) as ActionIncludingHypothetical;
  });
  return { store, runtime, send, ready, diagnostic, room, replay, start, echo, sentActions };
}

describe('active replay navigation', () => {
  test.each([false, true])('local navigation does not send or require readiness (shared=%s)', (shared) => {
    const { runtime, send, ready, replay } = makeRuntime(shared, 'Bob');
    ready.mockReturnValue(false);
    expect(runtime.navigateReplaySegment(0)).toBe(true);
    expect(replay().segment).toBe(0);
    expect(send).not.toHaveBeenCalled();
    expect(ready).not.toHaveBeenCalled();
    if (shared) {
      expect(replay().shared).toMatchObject({ segment: 1, useSharedSegments: false });
      runtime.receiveEvent(1, { command: 'replaySegment', data: { tableID: 123, segment: 1 } });
      expect(replay().segment).toBe(0);
      expect(runtime.followReplayLeader()).toBe(true);
      expect(replay().segment).toBe(1);
      expect(replay().shared?.useSharedSegments).toBe(true);
    }
    expect(runtime.followReplayLeader()).toBe(false);
    expect(send).not.toHaveBeenCalled();
  });

  test('shared leader broadcasts through readiness guard and waits for echo', () => {
    const { runtime, replay, send, ready } = makeRuntime();
    expect(runtime.followReplayLeader()).toBe(false);
    for (const invalid of [-1, 0.5, NaN, 999]) expect(runtime.navigateReplaySegment(invalid)).toBe(false);
    expect(send).not.toHaveBeenCalled();
    ready.mockReturnValue(false);
    expect(runtime.navigateReplaySegment(0)).toBe(false);
    expect(send).not.toHaveBeenCalled();
    ready.mockReturnValue(true);
    expect(runtime.navigateReplaySegment(0)).toBe(true);
    expect(ready).toHaveBeenLastCalledWith(123);
    expect(send).toHaveBeenLastCalledWith('replayAction {"tableID":123,"type":0,"segment":0}');
    expect(replay().segment).toBe(1);
    runtime.receiveEvent(1, { command: 'replaySegment', data: { tableID: 123, segment: 0 } });
    expect(replay().segment).toBe(0);
  });

  test('leadership requests validate spectators and wait for authoritative updates', () => {
    const { runtime, replay, send, ready } = makeRuntime(true, 'Bob');
    expect(runtime.setSharedReplayLeader('Bob')).toBe(false);
    expect(runtime.setSharedReplayLeader('Cy')).toBe(false);
    ready.mockReturnValue(false);
    expect(runtime.setSharedReplayLeader('Ada')).toBe(false);
    expect(send).not.toHaveBeenCalled();
    ready.mockReturnValue(true);
    expect(runtime.setSharedReplayLeader('Ada')).toBe(true);
    expect(send).toHaveBeenLastCalledWith('tableSetLeader {"tableID":123,"name":"Ada"}');
    expect(replay().shared?.amLeader).toBe(false);
    runtime.receiveEvent(1, { command: 'replayLeader', data: { tableID: 123, name: 'Ada' } });
    expect(replay().shared).toMatchObject({ leader: 'Ada', amLeader: true });
  });
});

describe('hypothetical operations', () => {
  test('solo lifecycle, morphs, clues, play, discard and back remain local', () => {
    const { runtime, replay, send, ready, store, start } = makeRuntime(false);
    ready.mockReturnValue(false);
    expect(runtime.navigateReplaySegment(1)).toBe(true);
    start();
    expect(runtime.startHypothetical()).toBe(false);
    expect(runtime.hypotheticalMorph(0, 1, 2)).toBe(true);
    expect(replay().hypothetical?.morphedIdentities[0]).toEqual({ suitIndex: 1, rank: 2 });
    expect(runtime.hypotheticalUnmorph(0)).toBe(true);
    expect(replay().hypothetical?.morphedIdentities[0]).toBeUndefined();
    const actor = replay().hypothetical!.ongoing.turn.currentPlayerIndex;
    expect(runtime.hypotheticalRankClue(actor === 0 ? 1 : 0, 1)).toBe(true);
    expect(runtime.backHypothetical()).toBe(true);
    expect(runtime.hypotheticalColorClue(actor === 0 ? 1 : 0, 0)).toBe(true);
    expect(runtime.backHypothetical()).toBe(true);
    const order = replay().hypothetical!.ongoing.hands[actor!]?.[0]!;
    expect(runtime.hypotheticalPlay(order)).toBe(true);
    expect(runtime.backHypothetical()).toBe(true);
    expect(runtime.endHypothetical()).toBe(true);
    expect(runtime.startHypothetical()).toBe(true);
    const discardActor = replay().hypothetical!.ongoing.turn.currentPlayerIndex!;
    expect(runtime.hypotheticalDiscard(replay().hypothetical!.ongoing.hands[discardActor]?.[0]!)).toBe(true);
    expect(runtime.toggleHypotheticalDrawnCards()).toBe(true);
    expect(replay().hypothetical?.showDrawnCards).toBe(true);
    expect(runtime.endHypothetical()).toBe(true);
    expect(replay().hypothetical).toBeNull();
    expect(runtime.endHypothetical()).toBe(false);
    expect(store.getState().room.pendingHypotheticalOperation).toBeNull();
    expect(send).not.toHaveBeenCalled();
    expect(ready).not.toHaveBeenCalled();
  });

  test.each(['follower', 'not ready'] as const)('%s cannot broadcast hypothetical operations', (gate) => {
    const { runtime, send, ready } = makeRuntime(true, gate === 'follower' ? 'Bob' : 'Ada');
    if (gate === 'not ready') ready.mockReturnValue(false);
    expect(runtime.startHypothetical()).toBe(false);
    runtime.receiveEvent(1, { command: 'hypoStart', data: { TableID: 123 } });
    expect(runtime.endHypothetical()).toBe(false);
    expect(runtime.hypotheticalMorph(0, 1, 2)).toBe(false);
    expect(runtime.hypotheticalUnmorph(0)).toBe(false);
    expect(runtime.hypotheticalPlay(5)).toBe(false);
    expect(runtime.hypotheticalDiscard(5)).toBe(false);
    expect(runtime.hypotheticalColorClue(0, 0)).toBe(false);
    expect(runtime.hypotheticalRankClue(0, 1)).toBe(false);
    expect(runtime.toggleHypotheticalDrawnCards()).toBe(false);
    runtime.receiveEvent(1, { command: 'hypoAction', data: hypoActionSchema.parse({ type: 'turn', num: 2, currentPlayerIndex: 0 }) });
    expect(runtime.backHypothetical()).toBe(false);
    expect(send).not.toHaveBeenCalled();
  });

  test('shared lifecycle waits for start, back, visibility and end events', () => {
    const { runtime, replay, send } = makeRuntime();
    expect(runtime.startHypothetical()).toBe(true);
    expect(send).toHaveBeenLastCalledWith('replayAction {"tableID":123,"type":3}');
    expect(replay().hypothetical).toBeNull();
    runtime.receiveEvent(1, { command: 'hypothetical', data: { actions: [], showDrawnCards: false } });
    expect(replay().hypothetical).not.toBeNull();
    expect(runtime.backHypothetical()).toBe(false);
    expect(runtime.toggleHypotheticalDrawnCards()).toBe(true);
    expect(replay().hypothetical?.showDrawnCards).toBe(false);
    runtime.receiveEvent(1, { command: 'hypoShowDrawnCards', data: { tableID: 123, showDrawnCards: true } });
    expect(replay().hypothetical?.showDrawnCards).toBe(true);
    runtime.receiveEvent(1, { command: 'hypoAction', data: hypoActionSchema.parse({ type: 'clue', clue: { type: 1, value: 1 }, giver: 1, list: [0], target: 0, ignoreNegative: false }) });
    runtime.receiveEvent(1, { command: 'hypoAction', data: hypoActionSchema.parse({ type: 'turn', num: 2, currentPlayerIndex: 0 }) });
    const statesBefore = replay().hypothetical!.states.length;
    expect(runtime.backHypothetical()).toBe(true);
    expect(replay().hypothetical?.states).toHaveLength(statesBefore);
    runtime.receiveEvent(1, { command: 'hypoBack', data: { TableID: 123 } });
    expect(replay().hypothetical?.states).toHaveLength(statesBefore - 1);
    expect(runtime.endHypothetical()).toBe(true);
    expect(send).toHaveBeenLastCalledWith('replayAction {"tableID":123,"type":4}');
    expect(replay().hypothetical).not.toBeNull();
    runtime.receiveEvent(1, { command: 'hypoEnd', data: { TableID: 123 } });
    expect(replay().hypothetical).toBeNull();
  });

  test('multi-frame operation stays pending until its final authoritative echo', () => {
    const { runtime, store, send, start, sentActions, echo } = makeRuntime();
    start();
    expect(runtime.hypotheticalRankClue(0, 1)).toBe(true);
    const actions = sentActions();
    expect(actions).toHaveLength(2);
    expect(store.getState().room.pendingHypotheticalOperation).toMatchObject({
      connectionEpoch: 1, tableID: 123, gameLoadEpoch: 1, finalAction: actions[1],
    });
    echo(actions[0]!);
    expect(store.getState().room.pendingHypotheticalOperation).not.toBeNull();
    expect(runtime.hypotheticalPlay(5)).toBe(false);
    expect(runtime.backHypothetical()).toBe(false);
    expect(send).toHaveBeenCalledTimes(2);
    echo(actions[1]!);
    expect(store.getState().room.pendingHypotheticalOperation).toBeNull();
    expect(runtime.hypotheticalPlay(0)).toBe(true);
  });

  test.each([0, 1])('send fails after %s frames: only a first-frame failure clears pending', (successfulFrames) => {
    const { runtime, store, send, start } = makeRuntime();
    start();
    if (successfulFrames === 1) send.mockReturnValueOnce(true);
    send.mockReturnValue(false);
    expect(runtime.hypotheticalRankClue(0, 1)).toBe(false);
    expect(send).toHaveBeenCalledTimes(successfulFrames + 1);
    const pending = store.getState().room.pendingHypotheticalOperation;
    if (successfulFrames === 0) {
      expect(pending).toBeNull();
    } else {
      expect(pending).not.toBeNull();
      send.mockReturnValue(true);
      expect(runtime.hypotheticalPlay(5)).toBe(false);
      expect(send).toHaveBeenCalledTimes(2);
      expect(runtime.endHypothetical()).toBe(true);
      expect(store.getState().room.pendingHypotheticalOperation).toBe(pending);
      runtime.receiveEvent(1, { command: 'hypoEnd', data: { TableID: 123 } });
      expect(store.getState().room.pendingHypotheticalOperation).toBeNull();
    }
  });

  test('validations reject malformed actions, invalid cards and invalid or empty clues before sending', () => {
    const { runtime, send, store, start } = makeRuntime();
    start();
    expect(runtime.sendHypotheticalAction({ type: 'invalid' } as unknown as ActionIncludingHypothetical)).toBe(false);
    expect(runtime.hypotheticalPlay(999)).toBe(false);
    expect(runtime.hypotheticalRankClue(1, 1)).toBe(false); // Self clue.
    expect(runtime.hypotheticalRankClue(0, 2)).toBe(false); // Zero touch.
    expect(runtime.hypotheticalRankClue(0, 6)).toBe(false);
    expect(runtime.hypotheticalColorClue(0, 99)).toBe(false);
    expect(send).not.toHaveBeenCalled();
    expect(store.getState().room.pendingHypotheticalOperation).toBeNull();
  });

  test('discard at maximum tokens and clues at zero tokens remain rejected', () => {
    const { runtime, send, replay, echo, start } = makeRuntime();
    runtime.receiveEvent(1, { command: 'replaySegment', data: { tableID: 123, segment: 0 } });
    start();
    expect(replay().hypothetical?.ongoing.clueTokens).toBe(8);
    expect(runtime.hypotheticalDiscard(0)).toBe(false);
    for (let i = 0; i < 8; i += 1) {
      const giver = i % 2;
      echo(hypoActionSchema.parse({ type: 'clue', clue: { type: 1, value: 1 }, giver, list: giver === 0 ? [5] : [0], target: 1 - giver, ignoreNegative: false }) as ActionIncludingHypothetical);
      echo(hypoActionSchema.parse({ type: 'turn', num: i + 1, currentPlayerIndex: 1 - giver }) as ActionIncludingHypothetical);
    }
    expect(replay().hypothetical?.ongoing.clueTokens).toBe(0);
    expect(runtime.hypotheticalRankClue(1, 1)).toBe(false);
    expect(runtime.hypotheticalColorClue(1, 0)).toBe(false);
    expect(send).not.toHaveBeenCalled();
  });
});

describe('inbound replay events', () => {
  test('suggestion and efficiency updates retain leader/follower ownership', () => {
    const { runtime, store, room, send } = makeRuntime();
    runtime.receiveEvent(1, { command: 'suggestion', data: { tableID: 123, userName: 'Bob', segment: 1 } });
    expect(store.getState().room.pendingReplaySuggestion).toMatchObject({ connectionEpoch: 1, tableID: 123, segment: 1 });
    const before = room().clientState.notes.efficiencyModifier;
    runtime.receiveEvent(1, { command: 'replayEfficiencyMod', data: { tableID: 123, mod: 2 } });
    expect(room().clientState.notes.efficiencyModifier).toBe(before);
    runtime.receiveEvent(1, { command: 'replayLeader', data: { tableID: 123, name: 'Bob' } });
    expect(store.getState().room.pendingReplaySuggestion).toBeNull();
    runtime.receiveEvent(1, { command: 'replayEfficiencyMod', data: { tableID: 123, mod: 2 } });
    expect(room().clientState.notes.efficiencyModifier).toBe(2);
    runtime.receiveEvent(1, { command: 'suggestion', data: { tableID: 123, userName: 'Ada', segment: 1 } });
    expect(store.getState().room.pendingReplaySuggestion).toBeNull();
    expect(send).not.toHaveBeenCalled();
  });

  test.each(['not JSON', JSON.stringify({ type: 'invalid' })])('malformed hypothetical snapshot reports only its epoch: %s', (encoded) => {
    const { runtime, replay, diagnostic, send } = makeRuntime();
    runtime.receiveEvent(1, { command: 'hypothetical', data: { actions: [encoded], showDrawnCards: false } });
    expect(diagnostic).toHaveBeenCalledWith(1);
    expect(replay().hypothetical).toBeNull();
    expect(send).not.toHaveBeenCalled();
  });

  test('hypothetical snapshots initialize their action history; ordinary replay ignores them', () => {
    const { runtime, replay, diagnostic } = makeRuntime();
    const morph = { type: 'morph', order: 0, suitIndex: 1, rank: 2 };
    const turn = { type: 'turn', num: 2, currentPlayerIndex: 0 };
    runtime.receiveEvent(1, { command: 'hypothetical', data: { actions: [JSON.stringify(morph), JSON.stringify(turn)], showDrawnCards: true } });
    expect(replay().hypothetical).toMatchObject({ actions: [turn], showDrawnCards: true });
    expect(replay().hypothetical?.morphedIdentities[0]).toEqual({ suitIndex: 1, rank: 2 });
    expect(diagnostic).not.toHaveBeenCalled();
    const solo = makeRuntime(false);
    solo.runtime.receiveEvent(1, { command: 'hypothetical', data: { actions: ['invalid'], showDrawnCards: true } });
    expect(solo.replay().hypothetical).toBeNull();
    expect(solo.diagnostic).not.toHaveBeenCalled();
  });

  test('hypothetical snapshots and action echoes retain strikes above three', () => {
    const { runtime, replay, diagnostic, send } = makeRuntime();
    const strike = { type: 'strike', num: 4, order: 5, turn: 1 };
    runtime.receiveEvent(1, {
      command: 'hypothetical', data: { actions: [JSON.stringify(strike)], showDrawnCards: false },
    });
    expect(replay().hypothetical?.actions).toEqual([strike]);
    expect(replay().hypothetical?.ongoing.strikes).toHaveLength(1);
    const nextStrike = { ...strike, num: 5 };
    runtime.receiveEvent(1, { command: 'hypoAction', data: hypoActionSchema.parse(nextStrike) });
    expect(replay().hypothetical?.actions).toEqual([strike, nextStrike]);
    expect(replay().hypothetical?.ongoing.strikes).toHaveLength(2);
    expect(replay().hypothetical?.stateActionLengths).toEqual([0]);
    expect(diagnostic).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
    expect(gameActionListSchema.safeParse({ tableID: 123, list: [strike] }).success).toBe(false);
  });

  test.each([{ epoch: 0, tableID: 123 }, { epoch: 1, tableID: 999 }])('reducers reject stale or wrong-room events: %j', ({ epoch, tableID }) => {
    const { runtime, store, room, start } = makeRuntime();
    const before = room();
    runtime.receiveEvent(epoch, { command: 'replaySegment', data: { tableID, segment: 0 } });
    runtime.receiveEvent(epoch, { command: 'replayLeader', data: { tableID, name: 'Bob' } });
    runtime.receiveEvent(epoch, { command: 'suggestion', data: { tableID, userName: 'Bob', segment: 1 } });
    runtime.receiveEvent(epoch, { command: 'replayEfficiencyMod', data: { tableID, mod: 2 } });
    runtime.receiveEvent(epoch, { command: 'hypoStart', data: { TableID: tableID } });
    expect(room()).toBe(before);
    expect(store.getState().room.pendingReplaySuggestion).toBeNull();
    start();
    const hypotheticalBefore = room();
    runtime.receiveEvent(epoch, { command: 'hypoEnd', data: { TableID: tableID } });
    runtime.receiveEvent(epoch, { command: 'hypoBack', data: { TableID: tableID } });
    runtime.receiveEvent(epoch, { command: 'hypoShowDrawnCards', data: { tableID, showDrawnCards: true } });
    expect(room()).toBe(hypotheticalBefore);
  });

  test('table-less hypothetical events still obey connection epoch guards', () => {
    const { runtime, room } = makeRuntime();
    runtime.receiveEvent(0, { command: 'hypothetical', data: { actions: [], showDrawnCards: false } });
    expect(room().clientState.replay.hypothetical).toBeNull();
    runtime.receiveEvent(1, { command: 'hypoStart', data: { TableID: 123 } });
    const before = room();
    runtime.receiveEvent(0, { command: 'hypoAction', data: hypoActionSchema.parse({ type: 'turn', num: 2, currentPlayerIndex: 0 }) });
    expect(room()).toBe(before);
  });
});
