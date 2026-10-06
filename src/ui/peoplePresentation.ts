import type { LobbyTable, LobbyUser } from '../protocol/lobbyProtocol';
import {
  isPregameSpectateEligible,
  isSpectateEligible,
} from '../runtime/LobbyRuntime';

export type PeopleTableAction = {
  label: 'Spectate' | 'Spectate pregame';
  tableID: number;
};

export type PeopleUserRow = {
  user: LobbyUser;
  isFriend: boolean;
  isOwnUser: boolean;
  canUseContextActions: boolean;
  location: string;
  tableAction: PeopleTableAction | null;
};

export function getPeopleRows(
  users: readonly LobbyUser[],
  friends: readonly string[],
  authenticatedUser: { userID: number; username: string } | null,
  tables: readonly LobbyTable[],
): PeopleUserRow[] {
  const friendNames = new Set(friends.map((name) => name.toLowerCase()));
  const tablesByID = new Map(tables.map((table) => [table.id, table]));

  return users.map((user) => {
    const table = user.tableID === undefined ? undefined : tablesByID.get(user.tableID);
    const isOwnUser = authenticatedUser !== null
      && (user.userID === authenticatedUser.userID
        || user.name.toLowerCase() === authenticatedUser.username.toLowerCase());
    const tableAction = !isOwnUser && table !== undefined && !table.sharedReplay
      ? getPeopleTableAction(table)
      : null;
    return {
      user,
      isFriend: friendNames.has(user.name.toLowerCase()),
      isOwnUser,
      canUseContextActions: !isOwnUser,
      location: table?.name ?? (user.tableID === undefined ? 'Online' : 'At table'),
      tableAction,
    };
  }).sort((left, right) => {
    if (left.isFriend !== right.isFriend) return left.isFriend ? -1 : 1;
    const nameOrder = left.user.name.localeCompare(right.user.name, undefined, {
      sensitivity: 'base',
    });
    return nameOrder !== 0 ? nameOrder : left.user.userID - right.user.userID;
  });
}

export function getPeopleSections(rows: readonly PeopleUserRow[], search: string) {
  const query = search.trim().toLowerCase();
  const matching = rows.filter((row) => row.user.name.toLowerCase().includes(query));
  return [
    { title: 'Friends', rows: matching.filter((row) => row.isFriend) },
    { title: 'Online', rows: matching.filter((row) => !row.isFriend) },
  ];
}

function getPeopleTableAction(table: LobbyTable): PeopleTableAction | null {
  if (table.running && isSpectateEligible(table)) {
    return { label: 'Spectate', tableID: table.id };
  }
  if (isPregameSpectateEligible(table)) {
    return { label: 'Spectate pregame', tableID: table.id };
  }
  return null;
}
