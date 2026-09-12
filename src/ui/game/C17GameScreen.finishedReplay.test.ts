import { expect, test } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';

function readC17Screen() {
  return fs.readFileSync(path.join(process.cwd(), 'src/ui/game/C17GameScreen.tsx'), 'utf8');
}

test('C17 finished replay is an authoritative read-only timeline with available notes', () => {
  const screen = readC17Screen();

  expect(screen).toContain('const isFinishedReplay = clientState?.finished === true;');
  expect(screen).toContain('selectedSegment: replay.segment,');
  expect(screen).toContain('reviewActive={isFinishedReplay || replay.active}');
  expect(screen).toContain('replayNotes={clientState.notes.allNotes}');
  expect(screen).toContain('const hasAvailableNote = (order: number) => finishedReplay');
  expect(screen).toContain('replayNotes[order]?.some((entry) => entry.text.trim().length > 0)');
  expect(screen).toContain("'No replay notes'");
  expect(screen).toContain("`Replay T${selectedTurn}${selectedActionSegment === actionSegments.at(-1) ? ' · End' : ''}`");
  expect(screen).toContain('{reviewActive && !finishedReplay ? <>');
  expect(screen).toContain('isQuickRematchEligible(clientState, roomState.pendingRestartTableID)');
  expect(screen).toContain('isRestartToPregameEligible(clientState, roomState.pendingRestartTableID)');
  expect(screen).toContain('onQuickRematch={() => lobbyRuntime.quickRematch()}');
  expect(screen).toContain('onRemake={() => lobbyRuntime.restartToPregame()}');
});
