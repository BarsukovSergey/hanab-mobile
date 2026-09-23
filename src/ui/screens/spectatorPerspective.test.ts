import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@jest/globals';

const app = readFileSync(resolve(__dirname, '../../../App.tsx'), 'utf8');

test('More shows authoritative spectator perspective choices only for ongoing live games', () => {
  expect(app).toContain("roomState.room.role === 'spectator'");
  expect(app).toContain('!roomState.room.sharedReplay');
  expect(app).toContain('!liveClientState.finished');
  expect(app).toContain('liveClientState.replay.databaseID === null');
  expect(app).toContain('const currentPerspective = liveClientState.shadowing');
  expect(app).toContain('liveClientState.metadata.ourPlayerIndex : -1');
  expect(app).toContain('title="Perspective"');
  expect(app).toContain("index === -1 ? 'All hands'");
  expect(app).toContain('liveClientState.metadata.playerNames.map((_, index) => index)');
  expect(app).toContain('disabled={index === currentPerspective}');
  expect(app).toContain('lobbyRuntime.setSpectatorPerspective(index)');
});
