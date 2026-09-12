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
  expect(screen).toContain('`SHARED REPLAY · Leader: ${sharedReplay.leader}`');
  expect(screen).toContain("? 'You control the shared segment.'");
  expect(screen).toContain('`Following ${sharedReplay.leader} at shared segment ${sharedReplay.segment}.`');
  expect(screen).toContain('`Viewing segment ${selectedActionSegment}; shared segment is ${sharedReplay.segment}.`');
  expect(screen).toContain('!sharedReplay.amLeader && !sharedReplay.useSharedSegments');
  expect(screen).toContain('title="Follow leader"');
  expect(screen).toContain('onPress={() => lobbyRuntime.followReplayLeader()}');
  expect(screen).toContain('reviewActive && !finishedReplay && sharedReplay === null');
  expect(screen).toContain('if (isFinishedReplay || isSharedReplay) return;');
});

test('C17 shared replay preserves existing leader-only restart eligibility', () => {
  const screen = readC17Screen();

  expect(screen).toContain('&& (replay.shared === null || replay.shared.amLeader);');
  expect(screen).toContain('const readOnlyReplay = finishedReplay || sharedReplay !== null;');
  expect(screen).toContain('const hasAvailableNote = (order: number) => readOnlyReplay');
});
