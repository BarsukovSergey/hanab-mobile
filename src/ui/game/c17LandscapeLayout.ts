import { getHandLabelGeometry } from './handLabelGeometry';
import { getRelativeOpponentIndices } from './c17DenseLayout';
import { HANABI_CARD_ASPECT_RATIO } from './gameplayLayout';
import { getLandscapeLastActionHeight, getLandscapeResourceEnvelope } from './landscapeResources';
import { getLandscapeWorkbenchEnvelope } from './landscapeWorkbench';

export type C17LandscapeInput = {
  availableWidth: number;
  availableHeight: number;
  fontScale: number;
  playerCount: number;
  cardsPerHand: number;
  seatingAnchorIndex: number;
  ownHandPosition: 'top' | 'bottom';
  /** Measured left header/context; already inside the safe-content window. */
  leftHeaderHeight?: number;
  /** Native Home/Chat/Menu widths, padding/gaps and minimum readable identity. */
  leftHeaderMinWidth?: number;
  /** Font-scaled native width of the fixed worst-value metric probe. */
  metricRowWidth?: number;
  suitCount?: number;
};

export type C17LandscapeLayout =
  | { fits: false; reason: 'invalid-envelope' | 'body-height' | 'card-floor' }
  | {
    fits: true;
    template: '1x2' | '1x3' | '2x2' | '2+2+1' | '3x2';
    rows: readonly (readonly number[])[];
    cardHeight: number;
    cardTopHeadroom: number;
    cellWidth: number;
    rowHeight: number;
    gridWidth: number;
    gridHeight: number;
    leftWidth: number;
    rightWidth: number;
    rightMin: number;
    rightComfort: number;
    workbenchHeight: number;
  };

export const C17_LANDSCAPE_REGION_GAP = 8;
export const C17_LANDSCAPE_COLUMN_GAP = 6;
export const C17_LANDSCAPE_ROW_GAP = 4;

/** Only the window and authoritative seating/capacity envelope allocate geometry. */
export function getC17LandscapeLayout(input: C17LandscapeInput): C17LandscapeLayout {
  const fixedHeight = getLandscapeMetricHeight(input.fontScale)
    + getLandscapeResourceEnvelope(input.fontScale, input.suitCount ?? 5).height
    + getLandscapeLastActionHeight(input.fontScale) + 12;
  const workbench = getLandscapeWorkbenchEnvelope(input.fontScale);
  if (input.availableHeight < fixedHeight + workbench.minimumHeight) return { fits: false, reason: 'body-height' };
  const grid = getC17LandscapeHandGrid(input);
  return grid.fits ? { ...grid, workbenchHeight: Math.min(workbench.comfortableHeight, input.availableHeight - fixedHeight) } : grid;
}

type HandGrid = Exclude<C17LandscapeLayout, { fits: true }>
  | Omit<Extract<C17LandscapeLayout, { fits: true }>, 'workbenchHeight'>;

/** Candidate hand fit is independent of the mandatory right-column height gate. */
export function getC17LandscapeHandGrid(input: C17LandscapeInput): HandGrid {
  const { availableWidth, availableHeight, fontScale, playerCount, cardsPerHand,
    seatingAnchorIndex, ownHandPosition } = input;
  if (![availableWidth, availableHeight, fontScale, input.leftHeaderHeight ?? 0, input.leftHeaderMinWidth ?? 0, input.metricRowWidth ?? 0].every(Number.isFinite)
    || fontScale <= 0 || (input.leftHeaderHeight ?? 0) < 0 || (input.metricRowWidth ?? 0) < 0 || (input.leftHeaderMinWidth ?? 0) < 0
    || !Number.isInteger(playerCount) || playerCount < 2 || playerCount > 6
    || !Number.isInteger(cardsPerHand) || cardsPerHand < 1
    || !Number.isInteger(input.suitCount ?? 5) || (input.suitCount ?? 5) < 1
    || !Number.isInteger(seatingAnchorIndex) || seatingAnchorIndex < 0 || seatingAnchorIndex >= playerCount) {
    return { fits: false, reason: 'invalid-envelope' };
  }
  const scaledFont = Math.max(1, fontScale);
  const rightMin = Math.max(Math.ceil(252 * scaledFont), Math.ceil(input.metricRowWidth ?? 0),
    getLandscapeResourceEnvelope(fontScale, input.suitCount ?? 5).minimumWidth);
  const rightComfort = Math.max(rightMin, 320 + Math.ceil(32 * (scaledFont - 1)));
  const opponents = getRelativeOpponentIndices(playerCount, seatingAnchorIndex);
  const sequence = ownHandPosition === 'top'
    ? [seatingAnchorIndex, ...opponents] : [...opponents, seatingAnchorIndex];
  const paired = (indices: readonly number[]) => indices.reduce<number[][]>((rows, index, offset) => {
    if (offset % 2 === 0) rows.push([index]);
    else rows[rows.length - 1]!.push(index);
    return rows;
  }, []);
  const ownSingle = (otherRows: number[][]) => ownHandPosition === 'top'
    ? [[seatingAnchorIndex], ...otherRows] : [...otherRows, [seatingAnchorIndex]];
  const solve = (template: Extract<C17LandscapeLayout, { fits: true }>['template'], rows: number[][]): HandGrid => {
    const columns = Math.max(...rows.map((row) => row.length));
    const headroom = (height: number) => Math.max(3, Math.min(6, Math.round(height * 0.06)));
    const cellWidth = (height: number) => cardsPerHand * height * HANABI_CARD_ASPECT_RATIO
      + (cardsPerHand - 1) * 3 + 8;
    const gridWidth = (height: number) => columns * cellWidth(height) + (columns - 1) * C17_LANDSCAPE_COLUMN_GAP;
    const rowHeight = (height: number) => height + getHandLabelGeometry(fontScale).landscapeHeight + 4 + headroom(height);
    const gridHeight = (height: number) => rows.length * rowHeight(height) + (rows.length - 1) * C17_LANDSCAPE_ROW_GAP;
    const largestFit = (fits: (height: number) => boolean) => {
      let low = 0;
      let high = 112;
      while (low < high) {
        const candidate = Math.ceil((low + high) / 2);
        if (fits(candidate)) low = candidate;
        else high = candidate - 1;
      }
      return low;
    };
    const verticalMax = largestFit((height) => gridHeight(height) + (input.leftHeaderHeight ?? 0) <= availableHeight);
    const horizontalMax = largestFit((height) => gridWidth(height) + C17_LANDSCAPE_REGION_GAP + rightMin <= availableWidth);
    const cardHeight = Math.min(verticalMax, horizontalMax, 112);
    if (cardHeight < 68) return { fits: false, reason: 'card-floor' };
    const leftNeeded = gridWidth(cardHeight);
    const maxRight = availableWidth - C17_LANDSCAPE_REGION_GAP - Math.max(leftNeeded, input.leftHeaderMinWidth ?? 0);
    if (maxRight < rightMin) return { fits: false, reason: 'card-floor' };
    const rightWidth = Math.min(rightComfort, maxRight);
    return { fits: true, template, rows, cardHeight, cardTopHeadroom: headroom(cardHeight),
      cellWidth: cellWidth(cardHeight), rowHeight: rowHeight(cardHeight), gridWidth: leftNeeded,
      gridHeight: gridHeight(cardHeight), rightMin, rightComfort, rightWidth,
      leftWidth: availableWidth - C17_LANDSCAPE_REGION_GAP - rightWidth };
  };
  switch (playerCount) {
    case 2: return solve('1x2', sequence.map((index) => [index]));
    case 3: return solve('1x3', sequence.map((index) => [index]));
    case 4: return solve('2x2', paired(sequence));
    case 5: return solve('2+2+1', ownSingle(paired(opponents)));
    default: return solve('3x2', paired(sequence));
  }
}

export function getLandscapeMetricHeight(fontScale: number): number {
  return Math.ceil(34 * Math.max(1, fontScale));
}

/** Native intrinsic measurements include full values, labels, badges and row chrome.
 * A failed measurement never clips an interactive row or changes hand geometry. */
export function landscapeMetricsFit(rightWidth: number, measuredWidth: number, measuredHeight: number, fontScale: number): boolean {
  return [rightWidth, measuredWidth, measuredHeight, fontScale].every(Number.isFinite)
    && measuredWidth > 0 && measuredHeight > 0
    && Math.ceil(measuredWidth) <= rightWidth
    && Math.ceil(measuredHeight) <= getLandscapeMetricHeight(fontScale);
}
