import { StyleSheet, Text, View } from 'react-native';

import { getLastCluePresentation } from '../../game/selectors/lastClue';
import { getGameplayClueChoicesForPlayerIndex } from '../../game/selectors/gameplay';
import { useAppSelector } from '../../store/hooks';
import { useHanabTheme, useResponsiveLayout } from '../designSystem';
import { getDisplayedHandOrders } from './gamePresentation';

export function LastClueNotice() {
  const { theme } = useHanabTheme();
  const { width, height } = useResponsiveLayout();
  const landscapePhone = width > height && height < 700;
  const room = useAppSelector((state) => state.room.room);
  if (room.kind !== 'live_game' || room.clientState.finished || room.clientState.replay.active) return null;

  const slotStyle = landscapePhone ? styles.slotLandscape : styles.slot;
  const visibleState = room.clientState.visibleState;
  if (visibleState === null) return <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={slotStyle} />;

  const clue = getLastCluePresentation(room.clientState.replay.actions);
  if (clue === null) return <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={slotStyle} />;

  const names = room.clientState.metadata.playerNames;
  const metadata = room.clientState.metadata;
  const choices = getGameplayClueChoicesForPlayerIndex(metadata, clue.giverPlayerIndex);
  const targetHand = getDisplayedHandOrders(visibleState.hands[clue.targetPlayerIndex] ?? []);
  const touchedPositions = clue.touchedOrders
    .map((order) => targetHand.findIndex((candidate) => candidate === order) + 1)
    .filter((position) => position > 0);
  const giver = names[clue.giverPlayerIndex] ?? `Player ${clue.giverPlayerIndex + 1}`;
  const target = names[clue.targetPlayerIndex] ?? `Player ${clue.targetPlayerIndex + 1}`;
  const choice = clue.clueType === 'rank'
    ? choices.ranks.find((candidate) => candidate.value === clue.value)
    : choices.colors.find((candidate) => candidate.value === clue.value);
  const clueLabel = choice?.label ?? (clue.clueType === 'rank' ? `rank ${clue.value}` : `color ${clue.value + 1}`);
  const touched = touchedPositions.length === 0 ? 'no cards' : `cards ${touchedPositions.join(', ')}`;

  return <View style={[
    slotStyle,
    styles.notice,
    { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.accent },
  ]}>
    <Text numberOfLines={1} style={[styles.text, landscapePhone && styles.textLandscape, { color: theme.colors.text }]}>
      {giver} → {target}: {clueLabel} · {touched}
    </Text>
  </View>;
}

const styles = StyleSheet.create({
  slot: { minHeight: 28 },
  slotLandscape: { minHeight: 20 },
  notice: { borderLeftWidth: 3, borderRadius: 7, justifyContent: 'center', paddingHorizontal: 8, paddingVertical: 3 },
  text: { fontSize: 10, fontWeight: '800' },
  textLandscape: { fontSize: 9 },
});
