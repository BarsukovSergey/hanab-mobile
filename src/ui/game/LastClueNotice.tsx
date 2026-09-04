import { StyleSheet, Text, View } from 'react-native';

import { getLastCluePresentation } from '../../game/selectors/lastClue';
import { getGameplayClueChoices } from '../../game/selectors/gameplay';
import { useAppSelector } from '../../store/hooks';
import { useHanabTheme, useResponsiveLayout } from '../designSystem';
import { getDisplayedHandOrders } from './gamePresentation';

export function LastClueNotice() {
  const { theme } = useHanabTheme();
  const { width, height } = useResponsiveLayout();
  const landscapePhone = width > height && height < 700;
  const room = useAppSelector((state) => state.room.room);
  if (room.kind !== 'live_game' || room.clientState.finished || room.clientState.replay.active) return null;

  const visibleState = room.clientState.visibleState;
  if (visibleState === null) return <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={landscapePhone ? styles.slotLandscape : styles.slot} />;

  const clue = getLastCluePresentation(room.clientState.replay.actions);
  if (clue === null) return <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={landscapePhone ? styles.slotLandscape : styles.slot} />;

  const names = room.clientState.metadata.playerNames;
  const variantName = room.clientState.metadata.options.variantName;
  const choices = getGameplayClueChoices(variantName);
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

  if (landscapePhone) {
    const touched = touchedPositions.length === 0 ? 'no cards' : touchedPositions.map((position) => `↓#${position}`).join(' ');
    return <View style={[styles.slotLandscape, styles.noticeLandscape, { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.accent }]}>
      <Text numberOfLines={1} style={[styles.landscapeText, { color: theme.colors.text }]}>{giver} → {target}: {clueLabel} · {touched}</Text>
    </View>;
  }

  return <View style={[styles.slot, styles.notice, { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.accent }]}>
    <View style={styles.copy}>
      <Text numberOfLines={1} style={[styles.label, { color: theme.colors.text }]}>{giver} → {target}</Text>
      <Text numberOfLines={1} style={[styles.detail, { color: theme.colors.textMuted }]}>{clueLabel}</Text>
    </View>
    <View style={styles.markers}>
      {touchedPositions.length === 0
        ? <Text style={[styles.none, { color: theme.colors.textMuted }]}>No cards touched</Text>
        : touchedPositions.map((position) => <View key={position} style={[styles.marker, { backgroundColor: theme.colors.surfaceRaised, borderColor: theme.colors.borderStrong }]}>
          <Text style={[styles.arrow, { color: theme.colors.text }]}>↓</Text>
          <Text style={[styles.cardNumber, { color: theme.colors.text }]}>#{position}</Text>
        </View>)}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  slot: { minHeight: 42 },
  slotLandscape: { minHeight: 24 },
  notice: { alignItems: 'center', borderLeftWidth: 3, borderRadius: 8, flexDirection: 'row', gap: 8, justifyContent: 'space-between', paddingHorizontal: 9, paddingVertical: 5 },
  noticeLandscape: { borderLeftWidth: 3, borderRadius: 6, justifyContent: 'center', paddingHorizontal: 7, paddingVertical: 3 },
  copy: { flex: 1, minWidth: 0 },
  label: { fontSize: 12, fontWeight: '800' },
  detail: { fontSize: 10, lineHeight: 13 },
  landscapeText: { fontSize: 10, fontWeight: '800' },
  markers: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 3, justifyContent: 'flex-end' },
  marker: { alignItems: 'center', borderRadius: 6, borderWidth: 1, minWidth: 25, paddingHorizontal: 3, paddingVertical: 1 },
  arrow: { fontSize: 12, fontWeight: '900', lineHeight: 11 },
  cardNumber: { fontSize: 8, fontWeight: '900', lineHeight: 9 },
  none: { fontSize: 9 },
});
