import { readFileSync } from 'node:fs';
import { describe, expect, it } from '@jest/globals';

const c17 = readFileSync('src/ui/game/C17GameScreen.tsx', 'utf8');
const legacy = readFileSync('src/ui/game/LegacyGameScreen.tsx', 'utf8');

describe('untimed clock visibility contracts', () => {
  it('shows C17 clocks for timed games or the enabled untimed setting and preserves suppressions', () => {
    const visibility = c17.slice(c17.indexOf('const liveClock ='), c17.indexOf('const latest ='));
    expect(c17).toContain("state.session.showTimerInUntimed");
    expect(visibility).toContain('(timed || showTimerInUntimed)');
    expect(visibility).toContain('!clientState.finished');
    expect(visibility).toContain('!replay.active');
    expect(visibility).toContain('!hypotheticalActive');
    expect(visibility).toContain('!liveRoom.sharedReplay');
    expect(visibility).toContain('ongoingGame.turn.currentPlayerIndex !== null');
    expect(visibility).toContain('liveRoom.clock !== null');
    expect(c17).toContain('getDisplayedClockString(clock, playerIndex, paused, now, timed)');
  });

  it('keeps Legacy pause timed-only while allowing untimed clock rendering', () => {
    const visibility = legacy.slice(legacy.indexOf('const showClock ='), legacy.indexOf('const latest ='));
    expect(legacy).toContain('state.session.showTimerInUntimed');
    expect(visibility).toContain('(timed || showTimerInUntimed)');
    expect(legacy).toContain('{timed && playerRoom !== null && <ActionButton compact title={pauseLabel}');
    expect(legacy).toContain('getDisplayedClockString(clock, playerIndex, paused, now, timed)');
  });
});
