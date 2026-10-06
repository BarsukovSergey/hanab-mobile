import { areTableOptionsSupported } from '../game/client/supportedVariants';
import type { LobbyTable } from '../protocol/lobbyProtocol';
import type { RoomState } from '../store/roomSlice';

export function isSpectateEligible(table: LobbyTable): boolean {
  return areTableOptionsSupported(table.options)
    && table.running
    && (table.sharedReplay || !table.joined);
}

export function isPregameSpectateEligible(table: LobbyTable): boolean {
  return areTableOptionsSupported(table.options)
    && !table.running
    && !table.sharedReplay
    && !table.joined;
}

export function isJoinEligible(table: LobbyTable): boolean {
  return !table.running
    && !table.sharedReplay
    && !table.joined
    && areTableOptionsSupported(table.options)
    && table.numPlayers < table.maxPlayers;
}

export function isReattendEligible(table: LobbyTable): boolean {
  return table.running
    && table.joined
    && !table.sharedReplay
    && areTableOptionsSupported(table.options);
}

export function isQuickRematchEligible(
  clientState: Extract<RoomState, { kind: 'live_game' }>['clientState'],
  pendingRestartTableID: number | null,
): boolean {
  const shared = clientState.replay.shared;
  if (
    shared === null
    || !shared.amLeader
    || pendingRestartTableID !== null
    || !clientState.metadata.playerNames.includes(clientState.metadata.ourUsername)
    || clientState.spectators.length < 2
  ) return false;
  const activeNames = new Set(clientState.spectators.map((spectator) => spectator.name));
  return clientState.metadata.playerNames.every((name) => activeNames.has(name));
}

export function isRestartToPregameEligible(
  clientState: Parameters<typeof isQuickRematchEligible>[0],
  pendingRestartTableID: number | null,
): boolean {
  const shared = clientState.replay.shared;
  return shared !== null
    && shared.amLeader
    && pendingRestartTableID === null
    && clientState.metadata.playerNames.includes(clientState.metadata.ourUsername)
    && clientState.spectators.length >= 2;
}
