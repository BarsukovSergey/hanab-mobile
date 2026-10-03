import type { CardIdentity, GameState } from '../bootstrap/types';
import { isEngineTrash } from './cardStatePresentation';

/** Preserve authoritative suit-stack order and every individual card. */
export function getDiscardPresentation(game: GameState, identities?: readonly CardIdentity[]) {
  const cards = game.discardStacks.flatMap((stack) => stack.flatMap((order) => {
    const card = game.deck[order];
    if (card === undefined) return [];
    const identity = identities?.[order] ?? card;
    return [{ order, suitIndex: identity.suitIndex, rank: identity.rank,
      faded: isEngineTrash(game, identity.suitIndex, identity.rank) }];
  }));
  return { cards, relevantCards: cards.filter((card) => !card.faded) };
}
