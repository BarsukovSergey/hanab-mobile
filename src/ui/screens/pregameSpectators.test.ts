import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from '@jest/globals';

describe('pregame spectator presentation', () => {
  test('reads table-scoped authoritative spectators and keeps player controls', () => {
    const source = readFileSync(resolve(__dirname, 'PregameScreen.tsx'), 'utf8');
    expect(source).toContain('roomState.pregameSpectators?.tableID === room.tableID');
    expect(source).toContain('title="Spectators"');
    expect(source).toContain('No spectators');
    expect(source).toContain('{spectator.name}');
    expect(source).toContain('Watching {spectator.shadowingPlayerUsername}');
    expect(source).toContain("spectator.shadowingPlayerIndex !== -1");
    expect(source).not.toContain('formatPregamePlayerStats(player, room.data.players.length)');
    expect(source).toContain('<UserContextActions');
    expect(source).toContain('lobbyRuntime.startGame()');
  });
});
