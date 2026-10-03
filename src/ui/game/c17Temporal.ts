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
  cardOutcome: 'played' | 'discarded' | 'misplayed' | null;
  preActionSlot: number | null;
  cardIdentity: string | null;
  targetIndex: number | null;
  touchedSlots: readonly number[];
};

export type C17TemporalContext = {
  selectedSegment: number;
  selectedTurn: number;
  liveTurn: number;
  beforeSegment: number | null;
  afterSegment: number;
  previousSegment: number | null;
  nextSegment: number | null;
  previousActionSegment: number | null;
  nextActionSegment: number | null;
  newerActionCount: number;
  last: C17TemporalEntry;
  recent: readonly C17TemporalEntry[];
  entries: readonly C17TemporalEntry[];
};

type Input = {
  states: readonly (GameState | undefined)[];
  selectedSegment: number;
  variantName: string;
  reverseHands: boolean;
};

type TransitionFacts = Pick<
  C17TemporalEntry,
  'actionType' | 'actorIndex' | 'cardOutcome' | 'cardOrder' | 'preActionSlot' | 'cardIdentity' | 'targetIndex' | 'touchedSlots'
>;

// Upstream stores reducer turns from zero; player-facing action turns count from one.
export function getHumanTurnNumber(turnNum: number): number {
  return Math.max(1, turnNum + 1);
}

export function countC17TemporalStatesAfter(
  states: readonly (GameState | undefined)[],
  segment: number,
): number {
  return states.reduce((count, state, stateSegment) => (
    state !== undefined && stateSegment > segment ? count + 1 : count
  ), 0);
}

export function getC17TemporalContext({ states, selectedSegment, variantName, reverseHands }: Input): C17TemporalContext {
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
    return makeEntry(segment, before, after, variantName, reverseHands);
  }).filter((entry): entry is C17TemporalEntry => entry !== null);
  const firstStateSegment = available[0] ?? null;
  const actionEntries = entries.filter((entry) => entry.segment !== firstStateSegment);
  const timelineSegments = entries.map((entry) => entry.segment);
  const timelineIndex = timelineSegments.indexOf(resolvedSegment);
  const last = entries.find((entry) => entry.segment === resolvedSegment) ?? {
    ...emptyTransitionFacts(),
    segment: resolvedSegment,
    turn: resolvedSegment === firstStateSegment ? 0 : getHumanTurnNumber(selectedState?.turn.turnNum ?? 0),
    summary: resolvedSegment === firstStateSegment ? 'Game start' : selectedState?.log.at(-1)?.text ?? 'Game state updated',
  };
  const recentDepth = Math.max(5, selectedState?.hands.length ?? liveState?.hands.length ?? 2);
  const recent = actionEntries
    .filter((entry) => entry.segment < resolvedSegment)
    .slice(-recentDepth);
  const beforeSegment = selectedIndex > 0 ? available[selectedIndex - 1] ?? null : null;

  return {
    selectedSegment: resolvedSegment,
    selectedTurn: last.turn,
    liveTurn: getHumanTurnNumber(liveState?.turn.turnNum ?? selectedState?.turn.turnNum ?? 0),
    beforeSegment,
    afterSegment: resolvedSegment,
    previousSegment: beforeSegment,
    nextSegment: selectedIndex >= 0 && selectedIndex < available.length - 1
      ? available[selectedIndex + 1] ?? null
      : null,
    previousActionSegment: timelineIndex > 0
      ? timelineSegments[timelineIndex - 1] ?? null
      : null,
    nextActionSegment: timelineIndex >= 0 && timelineIndex < timelineSegments.length - 1
      ? timelineSegments[timelineIndex + 1] ?? null
      : null,
    newerActionCount: selectedIndex < 0 ? 0 : Math.max(0, available.length - selectedIndex - 1),
    last,
    recent,
    entries,
  };
}

function makeEntry(
  segment: number,
  before: GameState | undefined,
  after: GameState,
  variantName: string,
  reverseHands: boolean,
): C17TemporalEntry {
  if (before === undefined) {
    return {
      segment,
      turn: 0,
      summary: 'Game start',
      ...emptyTransitionFacts(),
    };
  }

  const beforeLogLength = before.log.length;
  const actionLog = after.log.slice(beforeLogLength).at(-1);
  const authoritativeText = actionLog?.text
    ?? after.log.at(-1)?.text
    ?? 'Game state updated';
  const facts = getTransitionFacts(before, after, variantName, reverseHands);
  const details = getTransitionDetails(before, after, variantName, facts);

  return {
    segment,
    turn: actionLog?.turn ?? getHumanTurnNumber(after.turn.turnNum),
    summary: details.length === 0 ? authoritativeText : `${authoritativeText} · ${details.join(' · ')}`,
    ...facts,
  };
}

function getTransitionFacts(before: GameState, after: GameState, variantName: string, reverseHands: boolean): TransitionFacts {
  for (const [playerIndex, hand] of before.hands.entries()) {
    const displayedHand = getDisplayedHandOrders(hand, reverseHands);
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
        cardOutcome: afterCard.isMisplayed ? 'misplayed' : played ? 'played' : 'discarded',
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
    const displayedHand = getDisplayedHandOrders(before.hands[newClue.target], reverseHands);
    const touchedSlots = newClue.list
      .map((order) => displayedHand.indexOf(order) + 1)
      .filter((slot) => slot > 0)
      .sort((a, b) => a - b);
    return {
      actionType: 'clue',
      cardOutcome: null,
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
    details.push(facts.cardIdentity);
  }

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
    cardOutcome: null,
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

export type C17WorkbenchFeedback = { segment: number; cardOrder: number; outcome: 'played' | 'discarded' | 'misplayed' };

/** Only newly observed authoritative own confirmations replace existing feedback. */
export function getC17OwnActionFeedback(
  entries: readonly C17TemporalEntry[], afterSegment: number, ourPlayerIndex: number,
): C17WorkbenchFeedback | null {
  const entry = entries.filter((candidate) => candidate.segment > afterSegment
    && candidate.actorIndex === ourPlayerIndex && candidate.cardOrder !== null && candidate.cardOutcome !== null).at(-1);
  return entry === undefined ? null : { segment: entry.segment, cardOrder: entry.cardOrder!, outcome: entry.cardOutcome! };
}
