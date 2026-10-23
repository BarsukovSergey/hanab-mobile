import { expect, test } from '@jest/globals';
import type { RoomState } from '../store/roomSlice';
import { isReplayAttendanceRoom } from './replayExitEligibility';

test.each([
  [{}, false], [{ active: true }, false], [{ active: true, hypothetical: {} }, false],
  [{ finished: true }, true], [{ databaseID: 77 }, true], [{ databaseID: 0 }, true],
  [{ sharedReplay: true }, true], [{ shared: { amLeader: true } }, true],
  [{ shared: { amLeader: false }, hypothetical: {} }, true],
])('review attendance classification %j', (changes, expected) => {
  const options = changes as Record<string, unknown>;
  const room = { kind: 'live_game', sharedReplay: options.sharedReplay ?? false,
    clientState: { finished: options.finished ?? false, replay: {
      active: options.active ?? false, databaseID: options.databaseID ?? null,
      shared: options.shared ?? null, hypothetical: options.hypothetical ?? null,
    } } } as unknown as RoomState;
  expect(isReplayAttendanceRoom(room)).toBe(expected);
  expect(isReplayAttendanceRoom({ kind: 'none' })).toBe(false);
});
