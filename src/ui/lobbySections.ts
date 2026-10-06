import type { LobbyTable } from '../protocol/lobbyProtocol';
import { getLobbyFriendContext } from './lobbyTablePresentation';
import {
  isJoinEligible,
  isPregameSpectateEligible,
  isReattendEligible,
  isSpectateEligible,
} from '../runtime/lobbyEligibility';

export type LobbySections = {
  yourRunningGames: LobbyTable[];
  pregameTables: LobbyTable[];
  runningTables: LobbyTable[];
  sharedReplays: LobbyTable[];
  showCreateTable: boolean;
};

function friendsFirst(tables: LobbyTable[], friends: readonly string[]): LobbyTable[] {
  const friendTables: LobbyTable[] = [];
  const otherTables: LobbyTable[] = [];
  for (const table of tables) {
    (getLobbyFriendContext(table, friends).hasFriends ? friendTables : otherTables).push(table);
  }
  return [...friendTables, ...otherTables];
}

export function getLobbySections(tables: readonly LobbyTable[], friends: readonly string[] = []): LobbySections {
  const yourRunningGames = tables.filter(isReattendEligible);
  const pregameTables = tables.filter(
    (table) => isJoinEligible(table) || isPregameSpectateEligible(table),
  );
  const runningTables = tables.filter(
    (table) => !table.sharedReplay && isSpectateEligible(table),
  );
  const sharedReplays = tables.filter(
    (table) => table.sharedReplay && isSpectateEligible(table),
  );

  return {
    yourRunningGames,
    pregameTables: friendsFirst(pregameTables, friends),
    runningTables: friendsFirst(runningTables, friends),
    sharedReplays: friendsFirst(sharedReplays, friends),
    showCreateTable: yourRunningGames.length === 0,
  };
}
