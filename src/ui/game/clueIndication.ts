import {
  getGameplayClueChoicesForPlayerIndex,
  type GameplayClueChoices,
} from '../../game/selectors/gameplay';
import type { LastCluePresentation } from '../../game/selectors/lastClue';

export type ClueCardMarker = {
  kind: 'color' | 'rank';
  value: number;
  label: string;
  retouched: boolean;
};

type ClueMetadata = Parameters<typeof getGameplayClueChoicesForPlayerIndex>[0];

export function getCommittedClueMarkerForMetadata(
  clue: LastCluePresentation | null,
  order: number,
  numPositiveClues: number,
  metadata: ClueMetadata,
): ClueCardMarker | null {
  const choices = clue === null
    ? null
    : getGameplayClueChoicesForPlayerIndex(metadata, clue.giverPlayerIndex);
  return getCommittedClueMarker(clue, order, numPositiveClues, choices);
}

export function getCommittedClueMarker(
  clue: LastCluePresentation | null,
  order: number,
  numPositiveClues: number,
  choices: GameplayClueChoices | null,
): ClueCardMarker | null {
  if (clue === null || !clue.touchedOrders.includes(order)) return null;

  const choice = clue.clueType === 'rank'
    ? choices?.ranks.find((candidate) => candidate.value === clue.value)
    : choices?.colors.find((candidate) => candidate.value === clue.value);
  const fallback = clue.clueType === 'rank' ? String(clue.value) : `C${clue.value + 1}`;
  const fullLabel = choice?.label ?? fallback;

  return {
    kind: clue.clueType,
    value: clue.value,
    label: clue.clueType === 'rank' ? getRankBadgeLabel(fullLabel, clue.value) : fullLabel,
    // Upstream draws the arrow after the clue is applied. Two positive clues means this clue
    // retouched a card that had already been positively clued once.
    retouched: numPositiveClues >= 2,
  };
}

function getRankBadgeLabel(label: string, value: number): string {
  if (label === 'Odd') return 'O';
  if (label === 'Even') return 'E';
  // The web clue circle shows the rank value for ordinary rank clues. Avoid squeezing verbose
  // localized/variant labels into a 14px badge unless the variant has an explicit compact form.
  return String(value);
}
