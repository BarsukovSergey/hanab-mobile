export type C17WorkspaceEligibility = {
  isPlayer: boolean;
  playerCount: number;
  portrait: boolean;
  finished: boolean;
  replayActive: boolean;
};

/** The non-scrolling C17 workspace stays active for a player while reviewing live history. */
export function isC17WorkspaceEligible({
  isPlayer,
  playerCount,
  portrait,
  finished,
}: C17WorkspaceEligibility): boolean {
  return isPlayer
    && playerCount >= 2
    && playerCount <= 6
    && portrait
    && !finished;
}
