import { StyleSheet, Text, View } from 'react-native';

import { getLastCluePresentation } from '../../game/selectors/lastClue';
import { getGameplayClueChoices } from '../../game/selectors/gameplay';
import { useAppSelector } from '../../store/hooks';
import { useHanabTheme } from '../designSystem';
import { getDisplayedHandOrders } from './gamePresentation';

export function LastClueNotice() {
  const { theme } = useHanabTheme();
  const room = useAppSelector((state) => state.room.room);
  if (room.kind !== 'live_game' || room.clientState.finished || room.clientState.replay.active) return null;

  const clue = getLastCluePresentation(room.clientState.replay.actions);
  if (clue === null) return null;
  const names = room.clientState.metadata.playerNames;
  const variantName = room.clientState.metadata.options.variantName;
  const choices = getGameplayClueChoices(variantName);
  const targetHand = getDisplayedHandOrders(room.clientState.visibleState.hands[clue.targetPlayerIndex] ?? []);
  const touchedPositions = clue.touchedOrders
    .map((order) => targetHand.findIndex((candidate) => candidate === order) + 1)
    .filter((position) => position > 0);
  const giver = names[clue.giverPlayerIndex] ?? `Player ${clue.giverPlayerIndex + 1}`;
  const target = names[clue.targetPlayerIndex] ?? `Player ${clue.targetPlayerIndex + 1}`;
  const choice = clue.clueType === 'rank'
    ? choices.ranks.find((candidate) => candidate.value === clue.value)
    : choices.colors.find((candidate) => candidate.value === clue.value);
  const clueLabel = choice?.label ?? (clue.clueType === 'rank' ? `rank ${clue.value}` : `color ${clue.value + 1}`);
  const touchedLabel = touchedPositions.length === 0 ? 'no cards' : `cards ${touchedPositions.join(', ')}`;

  return <View style={[styles.notice, { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.accent }]}>
    <Text numberOfLines={1} style={[styles.label, { color: theme.colors.text }]}>{giver} → {target}: {clueLabel}</Text>
    <Text numberOfLines={1} style={[styles.detail, { color: theme.colors.textMuted }]}>Touched {touchedLabel}</Text>
  </View>;
}

const styles = StyleSheet.create({
  notice: { borderLeftWidth: 3, borderRadius: 8, gap: 1, paddingHorizontal: 9, paddingVertical: 6 },
  label: { fontSize: 12, fontWeight: '800' },
  detail: { fontSize: 10, lineHeight: 13 },
});
