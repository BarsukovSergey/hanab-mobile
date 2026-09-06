import type { GameState } from '../../game/bootstrap/types';
import { getDisplayedClueTokens } from '../../game/selectors/gameplay';
import { getDisplayedHandOrders } from './gamePresentation';

export type C17TemporalEntry = {
  segment: number;
  turn: number;
  summary: string;
};

export type C17TemporalContext = {
  selectedSegment: number;
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
  const latestState = states[available.at(-1) ?? resolvedSegment] ?? selectedState;
  const entries = available.map((segment, index) => {
    const after = states[segment];
    if (after === undefined) return null;
    const beforeSegment = index > 0 ? available[index - 1] : undefined;
    const before = beforeSegment === undefined ? undefined : states[beforeSegment];
    return makeEntry(segment, before, after, variantName);
  }).filter((entry): entry is C17TemporalEntry => entry !== null);
  const last = entries.find((entry) => entry.segment === resolvedSegment) ?? {
    segment: resolvedSegment,
    turn: getHumanTurnNumber(selectedState?.turn.turnNum ?? 0),
    summary: selectedState?.log.at(-1)?.text ?? 'Game start',
  };
  const recent = entries.filter((entry) => entry.segment < resolvedSegment).slice(-2);

  return {
    selectedSegment: resolvedSegment,
    previousSegment: selectedIndex > 0 ? available[selectedIndex - 1] ?? null : null,
    nextSegment: selectedIndex >= 0 && selectedIndex < available.length - 1
      ? available[selectedIndex + 1] ?? null
      : null,
    newerActionCount: selectedState === undefined || latestState === undefined
      ? 0
      : Math.max(0, latestState.log.length - selectedState.log.length),
    last,
    recent,
  };
}

function makeEntry(segment: number, before: GameState | undefined, after: GameState, variantName: string): C17TemporalEntry {
  const beforeLogLength = before?.log.length ?? 0;
  const authoritativeText = after.log.slice(beforeLogLength).at(-1)?.text
    ?? after.log.at(-1)?.text
    ?? (segment === 0 ? 'Game start' : 'Game state updated');
  const details = before === undefined ? [] : getTransitionDetails(before, after, variantName);

  return {
    segment,
    turn: getHumanTurnNumber(after.turn.turnNum),
    summary: details.length === 0 ? authoritativeText : `${authoritativeText} · ${details.join(' · ')}`,
  };
}

function getTransitionDetails(before: GameState, after: GameState, variantName: string): string[] {
  const details: string[] = [];
  const newClue = after.clues.length > before.clues.length ? after.clues.at(-1) : undefined;
  if (newClue !== undefined) {
    const displayedHand = getDisplayedHandOrders(before.hands[newClue.target]);
    const touchedSlots = newClue.list
      .map((order) => displayedHand.indexOf(order) + 1)
      .filter((slot) => slot > 0)
      .sort((a, b) => a - b);
    if (touchedSlots.length > 0) details.push(`Touched ${touchedSlots.join('/')}`);
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

function addDelta(details: string[], label: string, before: number, after: number): void {
  const delta = after - before;
  if (delta === 0) return;
  details.push(`${label} ${delta > 0 ? '+' : ''}${delta}`);
}
