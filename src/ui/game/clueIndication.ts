import type { GameplayClueChoices } from '../../game/selectors/gameplay';
import type { LastCluePresentation } from '../../game/selectors/lastClue';

export type ClueCardMarker = {
  kind: 'color' | 'rank';
  value: number;
  label: string;
  retouched: boolean;
};

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

  return {
    kind: clue.clueType,
    value: clue.value,
    label: choice?.label ?? fallback,
    // Upstream draws the arrow after the clue is applied. Two positive clues means this clue
    // retouched a card that had already been positively clued once.
    retouched: numPositiveClues >= 2,
  };
}
