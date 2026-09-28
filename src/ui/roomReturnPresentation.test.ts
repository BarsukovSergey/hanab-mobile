import { describe, expect, test } from '@jest/globals';
import type { RoomState } from '../store/roomSlice';
import { getFocusedRoomBackDecision, getRoomReturnPresentation } from './roomReturnPresentation';

const pregame = (role: 'player' | 'spectator'): RoomState => ({
  kind: 'pregame', role, tableID: 1, data: { players: ['Alice', 'Bob'], maxPlayers: 5 },
} as unknown as RoomState);
const bootstrap = { kind: 'awaiting_game_bootstrap', tableID: 1 } as RoomState;
const live = (changes: {
  finished?: boolean; active?: boolean; shared?: object | null; hypothetical?: object | null;
  sharedReplay?: boolean; role?: 'player' | 'spectator'; currentPlayerIndex?: number;
  turnNum?: number; score?: number;
} = {}): RoomState => ({
  kind: 'live_game', tableID: 1, role: changes.role ?? 'player', sharedReplay: changes.sharedReplay ?? false,
  clientState: {
    finished: changes.finished ?? false, playing: true,
    replay: { active: changes.active ?? false, shared: changes.shared ?? null, hypothetical: changes.hypothetical ?? null },
    metadata: { ourPlayerIndex: 0 },
    ongoingGame: { score: changes.score ?? 23, turn: { currentPlayerIndex: changes.currentPlayerIndex ?? 1, turnNum: changes.turnNum ?? 0 } },
  },
} as unknown as RoomState);

describe('room Return presentation', () => {
  test('unowned, Pregame, bootstrap, and recovery states', () => {
    expect(getRoomReturnPresentation({ kind: 'none' }, false)).toBeNull();
    expect(getRoomReturnPresentation(pregame('player'), false)).toEqual({ status: 'PLAYER · 2/5', action: 'Return to table', behavior: 'focus-room' });
    expect(getRoomReturnPresentation(pregame('spectator'), false)).toEqual({ status: 'SPECTATOR · 2/5', action: 'Return to table', behavior: 'focus-room' });
    expect(getRoomReturnPresentation(bootstrap, false)).toEqual({ status: 'Loading game', action: 'Return to room', behavior: 'focus-room' });
    expect(getRoomReturnPresentation({ kind: 'none' }, true)).toEqual({ status: 'Reconnecting', action: 'Return to room', behavior: 'focus-room' });
    expect(getRoomReturnPresentation(live({ currentPlayerIndex: 0 }), true)).toEqual({ status: 'Reconnecting', action: 'Return to room', behavior: 'focus-room' });
  });

  test('hypothetical, own Rewind, finished, solo replay, and shared review', () => {
    expect(getRoomReturnPresentation(live({ hypothetical: {} }), false)).toEqual({ status: 'HYPOTHETICAL', action: 'Return to hypothetical', behavior: 'focus-room' });
    expect(getRoomReturnPresentation(live({ active: true }), false)).toEqual({ status: 'REWIND', action: 'Return to Live', behavior: 'return-live' });
    expect(getRoomReturnPresentation(live({ finished: true, shared: {}, score: 25 }), false)).toEqual({ status: 'Finished · 25', action: 'Review game', behavior: 'focus-room' });
    expect(getRoomReturnPresentation(live({ finished: true }), false)).toEqual({ status: 'REPLAY', action: 'Return to review', behavior: 'focus-room' });
    expect(getRoomReturnPresentation(live({ finished: true, sharedReplay: true }), false)).toEqual({ status: 'SHARED REVIEW', action: 'Return to review', behavior: 'focus-room' });
  });

  test('ordinary Live has a one-based human turn and only playable own turn is urgent', () => {
    expect(getRoomReturnPresentation(live({ currentPlayerIndex: 0 }), false)).toEqual({ status: 'YOUR TURN', action: 'Return to game', behavior: 'focus-room' });
    expect(getRoomReturnPresentation(live({ turnNum: 0 }), false)?.status).toBe('LIVE · T1');
    expect(getRoomReturnPresentation(live({ turnNum: 9, role: 'spectator', currentPlayerIndex: 0 }), false)?.status).toBe('LIVE · T10');
  });

  test('focused Back priority follows hypothetical, own Rewind, review, ordinary Live', () => {
    expect(getFocusedRoomBackDecision(live({ active: true, hypothetical: {} }))).toBe('browse-origin');
    expect(getFocusedRoomBackDecision(live({ active: true }))).toBe('return-live');
    expect(getFocusedRoomBackDecision(live({ finished: true, active: true }))).toBe('browse-origin');
    expect(getFocusedRoomBackDecision(live({ sharedReplay: true }))).toBe('browse-origin');
    expect(getFocusedRoomBackDecision(live())).toBe('consume');
    expect(getFocusedRoomBackDecision(pregame('player'))).toBe('consume');
    expect(getFocusedRoomBackDecision(bootstrap)).toBe('consume');
  });
});
