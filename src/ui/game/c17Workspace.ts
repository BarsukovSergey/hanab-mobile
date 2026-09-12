export type C17WorkspaceEligibility = {
  /** Compatibility input for callers that only route players. */
  isPlayer?: boolean;
  /** A live player or spectator may use the C17 workspace. */
  isLiveParticipant?: boolean;
  playerCount: number;
  portrait: boolean;
  finished: boolean;
  replayActive: boolean;
  /** Shared replay uses the same portrait C17 workspace as other replay states. */
  sharedReplay?: boolean;
};

/** The non-scrolling C17 workspace stays active for a live player or spectator while reviewing history. */
export function isC17WorkspaceEligible({
  isPlayer,
  isLiveParticipant,
  playerCount,
  portrait,
}: C17WorkspaceEligibility): boolean {
  return (isLiveParticipant ?? isPlayer ?? false)
    && playerCount >= 2
    && playerCount <= 6
    && portrait;
}
