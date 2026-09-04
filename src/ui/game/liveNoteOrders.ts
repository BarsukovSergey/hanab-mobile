import type { GameState } from '../../game/bootstrap/types';

export function getLiveNoteOrders(game: Pick<GameState, 'hands'> | null): readonly number[] {
  return game?.hands.flatMap((hand) => hand) ?? [];
}
