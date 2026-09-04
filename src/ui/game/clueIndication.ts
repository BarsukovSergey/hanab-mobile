import type { GameplayClueChoices } from '../../game/selectors/gameplay';
import type { LastCluePresentation } from '../../game/selectors/lastClue';

export type ClueCardMarker = {
  kind: 'color' | 'rank';
  label: string;
  fill: string | null;
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
  const label = choice?.label ?? fallback;

  return {
    kind: clue.clueType,
    label,
    fill: clue.clueType === 'color' ? commonClueFill(label) : null,
    // Upstream draws the arrow after the clue is applied. Two positive clues means this clue
    // retouched a card that had already been positively clued once.
    retouched: numPositiveClues >= 2,
  };
}

function commonClueFill(label: string): string | null {
  switch (label.trim().toLowerCase()) {
    case 'red': return '#ff7777';
    case 'yellow': return '#ffff77';
    case 'green': return '#77ee77';
    case 'blue': return '#99aaff';
    case 'purple': return '#bb77dd';
    case 'orange': return '#ffb347';
    case 'pink': return '#ff9fca';
    case 'brown': return '#a87850';
    case 'gray':
    case 'grey': return '#aaaaaa';
    case 'white': return '#ffffff';
    case 'black': return '#222222';
    default: return null;
  }
}
