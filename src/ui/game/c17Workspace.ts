export type C17WorkspaceEligibility = {
  /** Compatibility input for callers that only route players. */
  isPlayer?: boolean;
  /** A live player or spectator may use the C17 workspace. */
  isLiveParticipant?: boolean;
  playerCount: number;
  /** Retained for compatibility; C17 stays mounted in either orientation. */
  portrait: boolean;
  finished: boolean;
  replayActive: boolean;
  /** Shared replay uses the same portrait C17 workspace as other replay states. */
  sharedReplay?: boolean;
};

/** C17 stays mounted for an eligible live participant while reviewing history or rotating. */
export function isC17WorkspaceEligible({
  isPlayer,
  isLiveParticipant,
  playerCount,
}: C17WorkspaceEligibility): boolean {
  return (isLiveParticipant ?? isPlayer ?? false)
    && playerCount >= 2
    && playerCount <= 6;
}
