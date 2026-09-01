/** Pinned upstream spectator shape used by shared replays. */
export interface Spectator {
  readonly name: string;
  readonly shadowingPlayerIndex: number;
  readonly shadowingPlayerUsername: string;
}
