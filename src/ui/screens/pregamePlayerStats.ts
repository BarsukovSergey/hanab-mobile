import type { PregameGame } from '../../protocol/lobbyProtocol';

type PregamePlayer = PregameGame['players'][number];

export function formatPregamePlayerStats(player: PregamePlayer, tablePlayerCount: number): string {
  const { numGames, variant } = player.stats;
  const average = variant.averageScore === 0 ? '—' : variant.averageScore.toFixed(1);
  const strikeoutRate = variant.numGames === 0
    ? '—'
    : `${(variant.numStrikeouts / variant.numGames * 100).toFixed(1)}%`;
  const bestScore = variant.bestScores.find((entry) => entry.numPlayers === tablePlayerCount);

  return `Games ${numGames} · Variant ${variant.numGames} · Avg ${average}`
    + ` · Strikeouts ${strikeoutRate} · Best ${bestScore?.score ?? '—'}`;
}
