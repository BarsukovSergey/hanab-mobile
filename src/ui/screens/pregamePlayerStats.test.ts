import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from '@jest/globals';

import type { PregameGame } from '../../protocol/lobbyProtocol';
import { formatPregamePlayerStats } from './pregamePlayerStats';

const player: PregameGame['players'][number] = {
  index: 0,
  name: 'Ada',
  you: true,
  present: true,
  stats: {
    numGames: 123,
    variant: {
      numGames: 20,
      averageScore: 23.46,
      numStrikeouts: 3,
      bestScores: [
        { numPlayers: 2, score: 25, modifier: 1 },
        { numPlayers: 3, score: 24, modifier: -1 },
      ],
    },
  },
};

describe('pregame player stats', () => {
  test('formats counts, one-decimal average and strikeout rate, and table-size best', () => {
    expect(formatPregamePlayerStats(player, 3)).toBe(
      'Games 123 · Variant 20 · Avg 23.5 · Strikeouts 15.0% · Best 24',
    );
    expect(formatPregamePlayerStats(player, 2)).toContain('Best 25');
  });

  test('shows neutral values for no variant games and a missing best score', () => {
    const empty: typeof player = {
      ...player,
      stats: {
        ...player.stats,
        variant: { ...player.stats.variant, numGames: 0, averageScore: 0, numStrikeouts: 0 },
      },
    };
    const formatted = formatPregamePlayerStats(empty, 4);
    expect(formatted).toBe('Games 123 · Variant 0 · Avg — · Strikeouts — · Best —');
    expect(formatted).not.toMatch(/NaN|Infinity/);
  });

  test('Pregame root keeps the roster compact while preserving room actions and presence', () => {
    const source = readFileSync(resolve(__dirname, 'PregameScreen.tsx'), 'utf8');
    expect(source).not.toContain('formatPregamePlayerStats(player, room.data.players.length)');
    expect(source).toContain('<UserContextActions');
    expect(source).toContain('lobbyRuntime.setTableLeader(player.name)');
    expect(source).toContain("player.present ? 'Present' : 'Away'");
  });
});
