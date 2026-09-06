export type C17WorkspaceEligibility = {
  isPlayer: boolean;
  playerCount: number;
  portrait: boolean;
  finished: boolean;
  replayActive: boolean;
};

/** The non-scrolling C17 workspace is only for an active player at a live table. */
export function isC17WorkspaceEligible({
  isPlayer,
  playerCount,
  portrait,
  finished,
  replayActive,
}: C17WorkspaceEligibility): boolean {
  return isPlayer
    && playerCount >= 2
    && playerCount <= 6
    && portrait
    && !finished
    && !replayActive;
}
