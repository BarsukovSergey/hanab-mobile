import type { GameState } from '../../game/bootstrap/types';
import { getDisplayedClueTokens, getVisibleCardIdentityLabel } from '../../game/selectors/gameplay';
import { getDisplayedHandOrders } from './gamePresentation';

export type C17TemporalActionType = 'play' | 'discard' | 'clue' | 'other';

export type C17TemporalEntry = {
  segment: number;
  turn: number;
  summary: string;
  actionType: C17TemporalActionType;
  actorIndex: number | null;
  cardOrder: number | null;
  preActionSlot: number | null;
  cardIdentity: string | null;
  targetIndex: number | null;
  touchedSlots: readonly number[];
};

export type C17TemporalContext = {
  selectedSegment: number;
  selectedTurn: number;
  liveTurn: number;
  previousSegment: number | null;
  nextSegment: number | null;
  newerActionCount: number;
  last: C17TemporalEntry;
  recent: readonly C17TemporalEntry[];
};

type Input = {
  states: readonly (GameState | undefined)[];
  selectedSegment: number;
  variantName: string;
};

type TransitionFacts = Pick<
  C17TemporalEntry,
  'actionType' | 'actorIndex' | 'cardOrder' | 'preActionSlot' | 'cardIdentity' | 'targetIndex' | 'touchedSlots'
>;

// Upstream stores reducer turns from zero; player-facing logs and UI count from one.
export function getHumanTurnNumber(turnNum: number): number {
  return Math.max(1, turnNum + 1);
}

export function getC17TemporalContext({ states, selectedSegment, variantName }: Input): C17TemporalContext {
  const available = states.flatMap((state, segment) => state === undefined ? [] : [segment]);
  const resolvedSegment = states[selectedSegment] === undefined
    ? available.at(-1) ?? 0
    : selectedSegment;
  const selectedIndex = available.indexOf(resolvedSegment);
  const selectedState = states[resolvedSegment];
  const liveSegment = available.at(-1) ?? resolvedSegment;
  const liveState = states[liveSegment];
  const entries = available.map((segment, index) => {
    const after = states[segment];
    if (after === undefined) return null;
    const beforeSegment = index > 0 ? available[index - 1] : undefined;
    const before = beforeSegment === undefined ? undefined : states[beforeSegment];
    return makeEntry(segment, before, after, variantName);
  }).filter((entry): entry is C17TemporalEntry => entry !== null);
  const last = entries.find((entry) => entry.segment === resolvedSegment) ?? {
    ...emptyTransitionFacts(),
    segment: resolvedSegment,
    turn: getHumanTurnNumber(selectedState?.turn.turnNum ?? 0),
    summary: selectedState?.log.at(-1)?.text ?? 'Game start',
  };
  const recentDepth = Math.max(2, selectedState?.hands.length ?? liveState?.hands.length ?? 2);
  const recent = entries.filter((entry) => entry.segment < resolvedSegment).slice(-recentDepth);

  return {
    selectedSegment: resolvedSegment,
    selectedTurn: last.turn,
    liveTurn: getHumanTurnNumber(liveState?.turn.turnNum ?? selectedState?.turn.turnNum ?? 0),
    previousSegment: selectedIndex > 0 ? available[selectedIndex - 1] ?? null : null,
    nextSegment: selectedIndex >= 0 && selectedIndex < available.length - 1
      ? available[selectedIndex + 1] ?? null
      : null,
    newerActionCount: selectedIndex < 0 ? 0 : Math.max(0, available.length - selectedIndex - 1),
    last,
    recent,
  };
}

function makeEntry(
  segment: number,
  before: GameState | undefined,
  after: GameState,
  variantName: string,
): C17TemporalEntry {
  const beforeLogLength = before?.log.length ?? 0;
  const actionLog = after.log.slice(beforeLogLength).at(-1);
  const authoritativeText = actionLog?.text
    ?? after.log.at(-1)?.text
    ?? (segment === 0 ? 'Game start' : 'Game state updated');
  const facts = before === undefined
    ? emptyTransitionFacts()
    : getTransitionFacts(before, after, variantName);
  const details = before === undefined ? [] : getTransitionDetails(before, after, variantName, facts);

  return {
    segment,
    turn: actionLog?.turn ?? getHumanTurnNumber(after.turn.turnNum),
    summary: details.length === 0 ? authoritativeText : `${authoritativeText} · ${details.join(' · ')}`,
    ...facts,
  };
}

function getTransitionFacts(before: GameState, after: GameState, variantName: string): TransitionFacts {
  for (const [playerIndex, hand] of before.hands.entries()) {
    const displayedHand = getDisplayedHandOrders(hand);
    const afterHand = new Set(after.hands[playerIndex] ?? []);
    for (const [displayedIndex, order] of displayedHand.entries()) {
      if (afterHand.has(order)) continue;
      const beforeCard = before.deck[order];
      const afterCard = after.deck[order];
      if (beforeCard === undefined || afterCard === undefined) continue;
      const played = afterCard.segmentPlayed !== null
        && afterCard.segmentPlayed !== beforeCard.segmentPlayed;
      const discarded = afterCard.segmentDiscarded !== null
        && afterCard.segmentDiscarded !== beforeCard.segmentDiscarded;
      if (!played && !discarded) continue;

      return {
        actionType: played ? 'play' : 'discard',
        actorIndex: playerIndex,
        cardOrder: order,
        preActionSlot: displayedIndex + 1,
        cardIdentity: getVisibleCardIdentityLabel(variantName, afterCard.suitIndex, afterCard.rank),
        targetIndex: null,
        touchedSlots: [],
      };
    }
  }

  const newClue = after.clues.length > before.clues.length ? after.clues.at(-1) : undefined;
  if (newClue !== undefined) {
    const displayedHand = getDisplayedHandOrders(before.hands[newClue.target]);
    const touchedSlots = newClue.list
      .map((order) => displayedHand.indexOf(order) + 1)
      .filter((slot) => slot > 0)
      .sort((a, b) => a - b);
    return {
      actionType: 'clue',
      actorIndex: newClue.giver,
      cardOrder: null,
      preActionSlot: null,
      cardIdentity: null,
      targetIndex: newClue.target,
      touchedSlots,
    };
  }

  return emptyTransitionFacts();
}

function getTransitionDetails(
  before: GameState,
  after: GameState,
  variantName: string,
  facts: TransitionFacts,
): string[] {
  const details: string[] = [];
  if (
    (facts.actionType === 'play' || facts.actionType === 'discard')
    && facts.preActionSlot !== null
    && facts.cardIdentity !== null
  ) {
    details.push(`Before slot ${facts.preActionSlot}: ${facts.cardIdentity}`);
  }
  if (facts.touchedSlots.length > 0) details.push(`Touched ${facts.touchedSlots.join('/')}`);

  addDelta(details, 'Score', before.score, after.score);
  addDelta(
    details,
    'Clues',
    getDisplayedClueTokens(before.clueTokens, variantName),
    getDisplayedClueTokens(after.clueTokens, variantName),
  );
  addDelta(details, 'Strikes', before.strikes.length, after.strikes.length);
  addDelta(details, 'Deck', before.cardsRemainingInTheDeck, after.cardsRemainingInTheDeck);
  return details;
}

function emptyTransitionFacts(): TransitionFacts {
  return {
    actionType: 'other',
    actorIndex: null,
    cardOrder: null,
    preActionSlot: null,
    cardIdentity: null,
    targetIndex: null,
    touchedSlots: [],
  };
}

function addDelta(details: string[], label: string, before: number, after: number): void {
  const delta = after - before;
  if (delta === 0) return;
  details.push(`${label} ${delta > 0 ? '+' : ''}${delta}`);
}
