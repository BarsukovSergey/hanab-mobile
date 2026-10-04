import { expect, test } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';

function readC17Screen() {
  return fs.readFileSync(path.join(process.cwd(), 'src/ui/game/C17GameScreen.tsx'), 'utf8');
}

test('C17 shared replay presents authoritative leader and follow state without gameplay controls', () => {
  const screen = readC17Screen();

  expect(screen).toContain('const isSharedReplay = clientState?.replay.shared !== null;');
  expect(screen).toContain('&& !isFinishedReplay && !isSharedReplay;');
  expect(screen).toContain('selectedSegment: replay.segment,');
  expect(screen).toContain('sharedReplay={replay.shared}');
  expect(screen).not.toContain('SHARED REPLAY · Leader:');
  expect(screen).toContain('>Leader: {sharedReplay.leader}</Text>');
  expect(screen).not.toContain('You control the shared segment.');
  expect(screen).not.toContain('Following ${sharedReplay.leader} at shared segment');
  expect(screen).not.toContain('Viewing segment ${selectedActionSegment}; shared segment is');
  expect(screen).toContain('!sharedReplay.amLeader && !sharedReplay.useSharedSegments');
  expect(screen).toContain('title="Follow leader"');
  expect(screen).toContain('onPress={() => lobbyRuntime.followReplayLeader()}');
  expect(screen).toContain('reviewActive && !finishedReplay && sharedReplay === null');
  expect(screen).toContain('if (isFinishedReplay || isSharedReplay) return;');
  expect(screen).toContain(": hypothetical !== null ? <>");
  expect(screen).toContain('{sharedReplay === null ? <>');
  expect(screen).toContain('title="Take leadership"');
  expect(screen).toContain('title={`Pass to ${name}`}');
  expect(screen).toContain('{ height: layout.workbenchHeight, flexGrow: 0, flexShrink: 0 }');
  expect(screen).toContain('{sharedReplay.amLeader && sharedReplayPassTargets.map((name) => <ActionButton');
  expect(screen).not.toContain('CardKnowledgeDetails');
});

test('C17 shared replay renders its leader once and groups priority controls compactly', () => {
  const screen = readC17Screen();
  const sharedWorkbench = screen.slice(
    screen.indexOf('{sharedReplay === null ? <>'),
    screen.indexOf('{noteCard !== null && <View style={styles.noteInspect}>', screen.indexOf('{sharedReplay === null ? <>')),
  );

  expect((sharedWorkbench.match(/Leader: \{sharedReplay\.leader\}/g) ?? []).length).toBe(1);
  const primaryControls = screen.slice(screen.indexOf('const replayPrimaryControls ='), screen.indexOf('const WorkbenchViewport ='));
  expect(sharedWorkbench).toContain('{portraitV2 && replayPrimaryControls}');
  expect(screen).toContain('styles.actionButtons]}>{replayPrimaryControls}');
  expect(primaryControls).toContain('title="Back" onLongPress={onReviewStart} onPress={onReviewBack}');
  expect(primaryControls).toContain('title="Forward" onLongPress={onReviewEnd} onPress={onReviewForward}');
  expect(primaryControls).toContain('title="Follow leader" tone="primary" onPress={() => lobbyRuntime.followReplayLeader()}');
  expect(sharedWorkbench).toContain('title="Take leadership" onPress={() => lobbyRuntime.setSharedReplayLeader(sharedReplayOwnName)}');
  expect(sharedWorkbench).toContain('title={`Pass to ${name}`}');
  expect(sharedWorkbench).toContain('title="Start Hypothetical" tone="primary" onPress={() => takeWorkbenchTask(onStartHypothetical)}');
  expect(sharedWorkbench).toContain('title="Quick rematch" tone="primary" onPress={onQuickRematch}');
  expect(sharedWorkbench).toContain('title="Remake table" onPress={onRemake}');
});

test('C17 shared replay preserves existing leader-only restart eligibility', () => {
  const screen = readC17Screen();

  expect(screen).toContain('&& (replay.shared === null || replay.shared.amLeader);');
  expect(screen).toContain('const readOnlyReplay = finishedReplay || sharedReplay !== null;');
  expect(screen).toContain('const hasAvailableNote = (order: number) => readOnlyReplay');
});

test('C17 shared replay exposes suggestion Accept and Dismiss using the user-facing turn offset', () => {
  const screen = readC17Screen();

  expect(screen).toContain('{pendingReplaySuggestion.userName} suggests turn {pendingReplaySuggestion.segment}');
  expect(screen).toContain('title="Accept" tone="primary" onPress={onAcceptReplaySuggestion}');
  expect(screen).toContain('title="Dismiss" onPress={onDismissReplaySuggestion}');
  expect(screen).toContain('lobbyRuntime.navigateReplaySegment(pendingReplaySuggestion.segment - 1)');
  expect(screen).toContain(') dispatch(roomActions.replaySuggestionCleared());');
});
