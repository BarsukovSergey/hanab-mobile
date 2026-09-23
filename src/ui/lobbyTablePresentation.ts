export function formatLobbyRoster(players: string[]): string | null {
  return players.length > 0 ? players.join(' · ') : null;
}
