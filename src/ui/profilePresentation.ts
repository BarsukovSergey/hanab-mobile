import type { LobbyTable, LobbyUser } from '../protocol/lobbyProtocol';
import { getPeopleRows } from './peoplePresentation';

export function getProfilePresentation(
  username: string,
  users: readonly LobbyUser[],
  friends: readonly string[],
  authenticatedUser: { userID: number; username: string } | null,
  tables: readonly LobbyTable[],
) {
  const row = getPeopleRows(users, friends, authenticatedUser, tables)
    .find((entry) => entry.user.name.toLowerCase() === username.toLowerCase());
  return {
    username: row?.user.name ?? username,
    presence: row ? (row.user.inactive ? 'Online (inactive)' : 'Online') : 'Presence unknown',
    location: row?.location ?? null,
    isFriend: friends.some((friend) => friend.toLowerCase() === username.toLowerCase()),
    isOwnUser: row?.isOwnUser ?? (authenticatedUser?.username.toLowerCase() === username.toLowerCase()),
    tableAction: row?.tableAction ?? null,
  };
}
