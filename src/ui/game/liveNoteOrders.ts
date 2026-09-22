type HandState = {
  readonly hands: ReadonlyArray<readonly number[]>;
};

export function getLiveNoteOrders(game: HandState | null): readonly number[] {
  return game?.hands.flatMap((hand) => hand) ?? [];
}
