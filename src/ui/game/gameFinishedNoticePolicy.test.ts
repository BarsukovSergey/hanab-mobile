import { expect, test } from '@jest/globals';
import type { RoomState } from '../../store/roomSlice';
import { getGameFinishedResult, observeGameFinish, type FinishObservation } from './gameFinishedNoticePolicy';

const active: FinishObservation = { owner: '1:123:1', finished: false, eligibleLive: true, ready: true, visible: true, appActive: true };
const ended = { ...active, finished: true, eligibleLive: false };

test('only an observed active lifetime announces exactly once, including spectator/opponent finishes', () => {
  const start = observeGameFinish(null, active);
  expect(start.show).toBe(false);
  const finish = observeGameFinish(start.memory, ended);
  expect(finish.show).toBe(true);
  expect(observeGameFinish(finish.memory, ended).show).toBe(false);
  expect(observeGameFinish(observeGameFinish(finish.memory, active).memory, ended).show).toBe(false);
  const next = observeGameFinish(finish.memory, { ...active, owner: '1:123:2' });
  expect(observeGameFinish(next.memory, { ...ended, owner: '1:123:2' }).show).toBe(true);
});

test.each(['visible', 'appActive', 'ready'] as const)('%s interruption consumes a hidden finish and never replays on resume', (flag) => {
  const start = observeGameFinish(null, active);
  const hidden = observeGameFinish(start.memory, { ...ended, [flag]: false });
  expect(hidden.show).toBe(false);
  expect(observeGameFinish(hidden.memory, ended).show).toBe(false);
  const interrupted = observeGameFinish(start.memory, { ...active, [flag]: false });
  expect(observeGameFinish(interrupted.memory, ended).show).toBe(false);
});

test('historical/finished hydration, shared review and reconnect reseed without announcement', () => {
  expect(observeGameFinish(null, ended).show).toBe(false);
  const shared = observeGameFinish(null, { ...active, eligibleLive: false });
  expect(observeGameFinish(shared.memory, ended).show).toBe(false);
  const live = observeGameFinish(null, active);
  expect(observeGameFinish(live.memory, { ...ended, owner: '2:123:2' }).show).toBe(false);
});

test.each([[1, 'Normal completion'], [2, 'Strikeout'], [3, 'Timeout'], [4, 'Terminated by player'], [10, 'Terminated by vote']] as Array<[number, string]>)(
  'authoritative reason %s and final ongoing score survive a scrubbed visible state', (endCondition, reason) => {
    const room = { gameHistory: { endCondition }, clientState: { ongoingGame: { score: 23, stats: { maxScore: 25 } },
      visibleState: { score: 4 }, replay: { actions: [{ type: 'gameOver', endCondition: 2 }] } } } as unknown as Extract<RoomState, { kind: 'live_game' }>;
    expect(getGameFinishedResult(room)).toEqual({ score: 23, maxScore: 25, reason });
  });

test('missing final reason is not guessed as Normal completion', () => {
  const room = { gameHistory: null, clientState: { ongoingGame: { score: 0, stats: { maxScore: 25 } },
    replay: { actions: [] } } } as unknown as Extract<RoomState, { kind: 'live_game' }>;
  expect(getGameFinishedResult(room).reason).toBe('Completion reason unavailable');
});
