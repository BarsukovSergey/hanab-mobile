import type { RoomState } from '../store/roomSlice';

// Labels only: all mode and follow information comes from the attended room.
export function getReviewWorkspacePresentation(room: Extract<RoomState, { kind: 'live_game' }>) {
  const { finished, replay } = room.clientState;
  const shared = room.sharedReplay || replay.shared !== null;
  const review = finished || replay.databaseID !== null || shared || replay.hypothetical !== null;
  const ownRewind = !review && replay.active;
  const markers: string[] = [];
  if (replay.hypothetical !== null) markers.push('HYPOTHETICAL');
  if (shared) {
    markers.push('SHARED REVIEW');
    if (replay.shared !== null) markers.push(replay.shared.amLeader ? 'Leader'
      : replay.shared.useSharedSegments ? 'Following leader' : 'Local view · Detached from leader');
  }
  if (finished) markers.push(`Finished · ${room.clientState.ongoingGame.score}`);
  return {
    review,
    ownRewind,
    identity: review ? replay.databaseID === null || replay.databaseID <= 0 ? 'REPLAY' : `REPLAY #${replay.databaseID}`
      : ownRewind ? 'REWIND' : 'LIVE',
    status: markers.join(' · '),
    menuTitle: review ? 'Review menu' : 'Game menu',
    menuAccessibilityLabel: review ? 'Open review menu' : 'Open game menu',
  };
}
