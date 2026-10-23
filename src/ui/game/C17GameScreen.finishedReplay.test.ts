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
  expect(screen).toContain('reviewActive={!hypotheticalActive && (isFinishedReplay || replay.active || isSharedReplay)}');
  expect(screen).toContain('replayNotes={clientState.notes.allNotes}');
  expect(screen).toContain('const readOnlyReplay = finishedReplay || sharedReplay !== null;');
  expect(screen).toContain('onDoublePress={readOnlyReplay || hypothetical !== null ? undefined : () => takeWorkbenchTask(() => onEditNote(order))}');
  expect(screen).toContain('reviewActive && !finishedReplay && sharedReplay === null ? <>');
  expect(screen).toContain('const hasAvailableNote = (order: number) => readOnlyReplay');
  expect(screen).toContain('replayNotes[order]?.some((entry) => entry.text.trim().length > 0)');
  expect(screen).toContain("'No replay notes'");
  expect(screen).toContain("`Replay T${selectedTurn}${selectedActionSegment === actionSegments.at(-1) ? ' · End' : ''}`");
  expect(screen).toContain(': hypothetical !== null ? <>');
  expect(screen).toContain('</> : reviewActive && !finishedReplay && sharedReplay === null ? <>');
  expect(screen).toContain('isQuickRematchEligible(clientState, roomState.pendingRestartTableID)');
  expect(screen).toContain('isRestartToPregameEligible(clientState, roomState.pendingRestartTableID)');
  expect(screen).toContain('onQuickRematch={() => lobbyRuntime.quickRematch()}');
  expect(screen).toContain('onRemake={() => lobbyRuntime.restartToPregame()}');
  expect(screen).toContain('`REPLAY T${selectedTurn}`');
  expect(screen).not.toContain('finishedStatus');
  expect(screen).toContain('<GameFinishedNotice room={liveRoom}');
  expect(screen).not.toContain('FINAL SCORE');
  expect(screen).toContain('const showRewindScrubber = reviewActive;');
  expect(screen).toContain('<View style={styles.workbenchScrubber}>');
  expect(screen).toContain('{ height: layout.workbenchHeight, flexGrow: 0, flexShrink: 0 }');
  expect(screen).toContain('const showWorkbench = workbenchFeedback !== null || hypothetical !== null || reviewActive || finishedReplay || sharedReplay !== null');
  expect(screen).not.toContain('CardKnowledgeDetails');
  expect(screen).not.toContain('scrollEnabled={!scrubberDragging}');
  expect(screen).not.toContain('onDragStateChange={setScrubberDragging}');
  expect(screen).toContain('title="Edit note" onPress={() => takeWorkbenchTask(() => onEditNote(selectedActionCard))}');
  expect(screen).not.toContain('Tap a card to inspect its note.');
  const ledgerChrome = screen.slice(screen.indexOf('<View style={styles.ledgerChrome}>'), screen.indexOf('<View onLayout={captureAmbientBody} style={styles.workspaceBody}>'));
  expect(ledgerChrome).not.toContain('FINAL SCORE');
});
