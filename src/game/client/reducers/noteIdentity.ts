import { eRange, newArray } from 'complete-common';

import { ALL_RESERVED_NOTES } from '../../upstream/abbreviations';
import type { Variant } from '../../upstream/interfaces/Variant';
import type { Rank } from '../../upstream/types/Rank';
import type { SuitIndex } from '../../upstream/types/SuitIndex';
import type { SuitRankTuple } from '../../upstream/types/SuitRankTuple';
import { START_CARD_RANK } from '../../upstream/constants';

interface CardIdentities {
  readonly suitIndices: SuitIndex[];
  readonly ranks: Rank[];
}

function parseSuit(variant: Variant, suitText: string): SuitIndex | null {
  const abbreviationIndex = variant.suitAbbreviations.findIndex(
    (abbreviation) => abbreviation.toLowerCase() === suitText,
  );
  if (abbreviationIndex !== -1) return abbreviationIndex as SuitIndex;
  const nameIndex = variant.suits.findIndex(
    (suit) => suit.displayName.toLowerCase() === suitText,
  );
  return nameIndex === -1 ? null : nameIndex as SuitIndex;
}

function parseRank(rankText: string): Rank | null {
  switch (rankText) {
    case '0':
    case 's':
    case 'S': return START_CARD_RANK;
    case '1': return 1;
    case '2': return 2;
    case '3': return 3;
    case '4': return 4;
    case '5': return 5;
    default: return null;
  }
}

function parseIdentities(variant: Variant, keyword: string): CardIdentities {
  const identityMatch = new RegExp(variant.identityNotePattern).exec(keyword);
  let suitIndex: SuitIndex | null = null;
  let rank: Rank | null = null;
  if (identityMatch !== null) {
    const squishText = extractSquishText(identityMatch);
    const suitIndices: SuitIndex[] = [];
    const ranks: Rank[] = [];
    if (squishText !== undefined) {
      for (const letter of squishText) {
        suitIndex = parseSuit(variant, letter);
        rank = parseRank(letter);
        if (suitIndex !== null) suitIndices.push(suitIndex);
        else if (rank !== null) ranks.push(rank);
      }
      if (suitIndices.length + ranks.length > 0) return { suitIndices, ranks };
    }
    const suitText = extractSuitText(identityMatch);
    if (suitText !== undefined) suitIndex = parseSuit(variant, suitText);
    const rankText = extractRankText(identityMatch);
    if (rankText !== undefined) rank = parseRank(rankText);
  }
  return {
    suitIndices: suitIndex === null ? [] : [suitIndex],
    ranks: rank === null ? [] : [rank],
  };
}

function identityMapToArray(
  variant: Variant,
  identityMap: ReadonlyArray<readonly boolean[]>,
): readonly SuitRankTuple[] {
  const possibilities: SuitRankTuple[] = [];
  for (const rank of variant.ranks) {
    const suitArray = identityMap[rank];
    if (suitArray === undefined) continue;
    for (const [index, possible] of suitArray.entries()) {
      if (possible) possibilities.push([index as SuitIndex, rank]);
    }
  }
  return possibilities;
}

function getPossibilitiesFromKeyword(
  variant: Variant,
  keyword: string,
): readonly SuitRankTuple[] {
  const { positiveCardIdentities, negativeCardIdentities } =
    getCardIdentitiesFromKeyword(variant, keyword);
  const identityMap: boolean[][] = [];
  const positiveRanks = new Set(
    positiveCardIdentities.length > 0 ? [] : variant.ranks,
  );
  for (const rank of variant.ranks) {
    identityMap[rank] = newArray(
      variant.suits.length,
      positiveRanks.has(rank),
    ) as boolean[];
  }
  for (const identities of [positiveCardIdentities, negativeCardIdentities]) {
    const isPositive = identities === positiveCardIdentities;
    for (const cardIdentities of identities) {
      const ranks = cardIdentities.ranks.length > 0
        ? cardIdentities.ranks
        : variant.ranks;
      const suitIndices = cardIdentities.suitIndices.length > 0
        ? cardIdentities.suitIndices
        : [...eRange(variant.suits.length)];
      for (const rank of ranks) {
        for (const suitIndex of suitIndices) {
          const rankMap = identityMap[rank];
          if (rankMap !== undefined) rankMap[suitIndex] = isPositive;
        }
      }
    }
  }
  return identityMapToArray(variant, identityMap);
}

function getCardIdentitiesFromKeyword(variant: Variant, keyword: string) {
  const positiveCardIdentities: CardIdentities[] = [];
  const negativeCardIdentities: CardIdentities[] = [];
  for (const rawSegment of keyword.split(',')) {
    const segment = rawSegment.trim();
    const isNegative = segment.startsWith('!');
    const identityText = isNegative ? segment.slice(1).trim() : segment;
    const identities = parseIdentities(variant, identityText);
    (isNegative ? negativeCardIdentities : positiveCardIdentities).push(identities);
  }
  return { positiveCardIdentities, negativeCardIdentities };
}

export function getPossibilitiesFromKeywords(
  variant: Variant,
  keywords: readonly string[],
): readonly SuitRankTuple[] {
  let possibilities: readonly SuitRankTuple[] = [];
  for (const keyword of keywords.length > 0 ? keywords : ['']) {
    if (keyword === '!') continue;
    const next = getPossibilitiesFromKeyword(variant, keyword);
    const intersection = next.filter(([nextSuit, nextRank]) => (
      possibilities.some(([oldSuit, oldRank]) => (
        nextSuit === oldSuit && nextRank === oldRank
      ))
    ));
    possibilities = intersection.length === 0 ? next : intersection;
  }
  return possibilities;
}

function extractSuitText(match: RegExpMatchArray): string | undefined {
  return match[1] ?? match[4] ?? match[5] ?? undefined;
}

function extractRankText(match: RegExpMatchArray): string | undefined {
  return match[2] ?? match[3] ?? match[6] ?? undefined;
}

function extractSquishText(match: RegExpMatchArray): string | undefined {
  const text = match[7]?.trim();
  return text !== undefined && !ALL_RESERVED_NOTES.has(text.toLowerCase())
    ? text
    : undefined;
}
