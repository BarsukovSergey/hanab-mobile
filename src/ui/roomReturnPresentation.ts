import type { RoomState } from '../store/roomSlice';
import { getHumanTurnNumber } from './game/c17Temporal';
import { getReviewWorkspacePresentation } from './reviewWorkspacePresentation';

export type RoomReturnPresentation = {
  status: string;
  action: string;
  behavior: 'focus-room' | 'return-live';
};

export function isOwnOngoingRewind(room: RoomState): boolean {
  return room.kind === 'live_game' && getReviewWorkspacePresentation(room).ownRewind;
}

export function getRoomReturnPresentation(room: RoomState, recovering: boolean): RoomReturnPresentation | null {
  if (recovering) return { status: 'Reconnecting', action: 'Return to room', behavior: 'focus-room' };
  if (room.kind === 'none') return null;
  if (room.kind === 'pregame') return {
    status: `${room.role === 'player' ? 'PLAYER' : 'SPECTATOR'} · ${room.data.players.length}/${room.data.maxPlayers}`,
    action: 'Return to table', behavior: 'focus-room',
  };
  if (room.kind === 'awaiting_game_bootstrap') return {
    status: room.bootstrap !== 'pending_c5' && room.bootstrap.phase === 'failed' ? 'Unable to load game' : 'Loading game',
    action: 'Return to room', behavior: 'focus-room',
  };
  const { clientState } = room;
  if (clientState.replay.hypothetical !== null) return {
    status: 'HYPOTHETICAL', action: 'Return to hypothetical', behavior: 'focus-room',
  };
  if (isOwnOngoingRewind(room)) return {
    status: 'REWIND', action: 'Return to Live', behavior: 'return-live',
  };
  if (room.sharedReplay) return {
    status: 'SHARED REVIEW', action: 'Return to review', behavior: 'focus-room',
  };
  if (clientState.finished && clientState.replay.shared === null) return {
    status: 'REPLAY', action: 'Return to review', behavior: 'focus-room',
  };
  if (clientState.finished && clientState.replay.shared !== null) return {
    status: 'SHARED REVIEW',
    action: 'Return to review', behavior: 'focus-room',
  };
  if (getReviewWorkspacePresentation(room).review) return {
    status: getReviewWorkspacePresentation(room).identity, action: 'Return to review', behavior: 'focus-room',
  };
  const ourTurn = room.role === 'player' && clientState.playing
    && clientState.ongoingGame.turn.currentPlayerIndex === clientState.metadata.ourPlayerIndex;
  return {
    status: ourTurn ? 'YOUR TURN' : `LIVE · T${getHumanTurnNumber(clientState.ongoingGame.turn.turnNum)}`,
    action: 'Return to game', behavior: 'focus-room',
  };
}

export type FocusedRoomBackDecision = 'consume' | 'browse-origin' | 'return-live';

export function getFocusedRoomBackDecision(room: RoomState): FocusedRoomBackDecision {
  if (room.kind !== 'live_game') return 'consume';
  if (room.clientState.replay.hypothetical !== null) return 'browse-origin';
  if (isOwnOngoingRewind(room)) return 'return-live';
  if (getReviewWorkspacePresentation(room).review) return 'browse-origin';
  return 'consume';
}
