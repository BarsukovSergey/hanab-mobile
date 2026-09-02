import {
  BLANK_NOTES,
  CHOP_MOVED_NOTES,
  CLUED_NOTES,
  DISCARD_PERMISSION_NOTES,
  EXCLAMATION_MARK_NOTES,
  FINESSED_NOTES,
  KNOWN_TRASH_NOTES,
  NEEDS_FIX_NOTES,
  QUESTION_MARK_NOTES,
  UNCLUED_NOTES,
} from '../../upstream/abbreviations';
import { START_CARD_RANK } from '../../upstream/constants';
import type { CardNote } from '../../upstream/interfaces/CardNote';
import type { Variant } from '../../upstream/interfaces/Variant';
import type { Rank } from '../../upstream/types/Rank';
import type { SuitIndex } from '../../upstream/types/SuitIndex';
import type { SuitRankTuple } from '../../upstream/types/SuitRankTuple';

function includesNote(notes: readonly string[], text: string): boolean {
  return notes.includes(text);
}

function rankTokens(rank: Rank): readonly string[] {
  return rank === START_CARD_RANK ? ['0', 's', 'start'] : [String(rank)];
}

function identityPossibilities(text: string, variant: Variant): readonly SuitRankTuple[] {
  if (!new RegExp(variant.identityNotePattern, 'i').test(text)) return [];

  const suits = variant.suits.map((suit, index) => ({
    index: index as SuitIndex,
    tokens: [variant.suitAbbreviations[index]?.toLowerCase(), suit.displayName.toLowerCase()]
      .filter((token): token is string => token !== undefined),
  }));
  const ranks = variant.ranks.map((rank) => ({ rank, tokens: rankTokens(rank) }));

  for (const suit of suits) {
    for (const suitToken of suit.tokens) {
      if (text === suitToken) return variant.ranks.map((rank) => [suit.index, rank]);
      for (const rank of ranks) {
        if (rank.tokens.some((rankToken) => (
          text === `${suitToken}${rankToken}`
          || text === `${suitToken} ${rankToken}`
          || text === `${rankToken}${suitToken}`
          || text === `${rankToken} ${suitToken}`
        ))) return [[suit.index, rank.rank]];
      }
    }
  }
  for (const rank of ranks) {
    if (rank.tokens.includes(text)) {
      return suits.map((suit) => [suit.index, rank.rank]);
    }
  }

  // The remaining identity-pattern match is the compact form (for example, "ry12").
  const suitIndexes = suits.filter((suit) => suit.tokens.some((token) => (
    token.length === 1 && text.includes(token)
  ))).map((suit) => suit.index);
  const matchingRanks = ranks.filter((rank) => rank.tokens.some((token) => (
    token.length === 1 && text.includes(token)
  ))).map((rank) => rank.rank);
  const possibleSuits = suitIndexes.length === 0
    ? suits.map((suit) => suit.index)
    : suitIndexes;
  const possibleRanks = matchingRanks.length === 0 ? variant.ranks : matchingRanks;

  return possibleSuits.flatMap((suitIndex) => (
    possibleRanks.map((rank) => [suitIndex, rank] as const)
  ));
}

/** Pure note classification retained from the pinned client note boundary. */
export function noteIdentity(text: string, variant: Variant): CardNote {
  const normalized = text.toLowerCase();
  return {
    possibilities: identityPossibilities(normalized, variant),
    knownTrash: includesNote(KNOWN_TRASH_NOTES, normalized),
    needsFix: includesNote(NEEDS_FIX_NOTES, normalized),
    questionMark: includesNote(QUESTION_MARK_NOTES, normalized),
    exclamationMark: includesNote(EXCLAMATION_MARK_NOTES, normalized),
    chopMoved: includesNote(CHOP_MOVED_NOTES, normalized),
    finessed: includesNote(FINESSED_NOTES, normalized),
    discardPermission: includesNote(DISCARD_PERMISSION_NOTES, normalized),
    blank: includesNote(BLANK_NOTES, normalized),
    unclued: includesNote(UNCLUED_NOTES, normalized),
    clued: includesNote(CLUED_NOTES, normalized),
    text,
  };
}

export const getNoteIdentity = noteIdentity;
