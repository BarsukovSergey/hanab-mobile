type RelevantAction = {
  type: string;
  clue?: { type: number; value: number };
  giver?: number;
  list?: readonly number[];
  target?: number;
};

export type LastCluePresentation = {
  giverPlayerIndex: number;
  targetPlayerIndex: number;
  clueType: 'color' | 'rank';
  value: number;
  touchedOrders: readonly number[];
};

export function getLastCluePresentation(actions: readonly RelevantAction[]): LastCluePresentation | null {
  for (let index = actions.length - 1; index >= 0; index -= 1) {
    const action = actions[index];
    if (action === undefined) continue;
    if (action.type === 'play' || action.type === 'discard') return null;
    if (
      action.type !== 'clue'
      || action.clue === undefined
      || action.giver === undefined
      || action.list === undefined
      || action.target === undefined
    ) continue;
    return {
      giverPlayerIndex: action.giver,
      targetPlayerIndex: action.target,
      clueType: action.clue.type === 0 ? 'color' : 'rank',
      value: action.clue.value,
      touchedOrders: action.list,
    };
  }
  return null;
}
