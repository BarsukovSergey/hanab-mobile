import type { LobbyTable } from '../protocol/lobbyProtocol';

export function formatLobbyRoster(players: string[]): string | null {
  return players.length > 0 ? players.join(' · ') : null;
}

export type LobbyFriendContext = {
  playing: string[];
  watching: string[];
  hasFriends: boolean;
};

export function getLobbyFriendContext(
  table: LobbyTable,
  friends: readonly string[],
): LobbyFriendContext {
  const friendNames = new Set(friends.map((name) => name.toLowerCase()));
  const playing = table.sharedReplay
    ? []
    : table.players.filter((name) => friendNames.has(name.toLowerCase()));
  const watching = table.spectators
    .map(({ name }) => name)
    .filter((name) => friendNames.has(name.toLowerCase()));
  return { playing, watching, hasFriends: playing.length > 0 || watching.length > 0 };
}
