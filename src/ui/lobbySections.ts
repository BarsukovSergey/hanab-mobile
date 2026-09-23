import type { LobbyTable } from '../protocol/lobbyProtocol';
import {
  isJoinEligible,
  isPregameSpectateEligible,
  isReattendEligible,
  isSpectateEligible,
} from '../runtime/LobbyRuntime';

export type LobbySections = {
  yourRunningGames: LobbyTable[];
  pregameTables: LobbyTable[];
  runningTables: LobbyTable[];
  sharedReplays: LobbyTable[];
  showCreateTable: boolean;
};

export function getLobbySections(tables: readonly LobbyTable[]): LobbySections {
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
    pregameTables,
    runningTables,
    sharedReplays,
    showCreateTable: yourRunningGames.length === 0,
  };
}
