import type { GameplayClueChoices } from '../../game/selectors/gameplay';
import type { LastCluePresentation } from '../../game/selectors/lastClue';

export type ClueCardMarker = {
  label: string;
  retouched: boolean;
};

export function getCommittedClueMarker(
  clue: LastCluePresentation | null,
  order: number,
  numPositiveClues: number,
  choices: GameplayClueChoices,
): ClueCardMarker | null {
  if (clue === null || !clue.touchedOrders.includes(order)) return null;

  const choice = clue.clueType === 'rank'
    ? choices.ranks.find((candidate) => candidate.value === clue.value)
    : choices.colors.find((candidate) => candidate.value === clue.value);
  const fallback = clue.clueType === 'rank' ? String(clue.value) : `C${clue.value + 1}`;
  const label = choice?.label ?? fallback;

  return {
    label: clue.clueType === 'rank' ? label : compactColorLabel(label),
    // The authoritative state is already post-clue. A touched card at 2+ positive clues
    // therefore had a positive clue before the clue we are currently indicating.
    retouched: numPositiveClues >= 2,
  };
}

function compactColorLabel(label: string): string {
  const word = label.trim().split(/\s+/)[0] ?? label;
  return word.length <= 2 ? word : word.slice(0, 1).toUpperCase();
}
