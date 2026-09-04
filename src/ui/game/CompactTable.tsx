import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { GameState } from '../../game/bootstrap/types';
import { getDiscardSummary } from '../../game/selectors/discardSummary';
import { getGameTableSuits } from '../../game/selectors/gameplay';
import { useHanabTheme } from '../designSystem';
import { VisibleHanabiCard } from './GameCard';

export function CompactTable({
  game,
  variantName,
  onOpenDiscards,
}: {
  game: GameState;
  variantName: string;
  onOpenDiscards?: () => void;
}) {
  const { theme } = useHanabTheme();
  const suits = getGameTableSuits(variantName, game);
  const discard = getDiscardSummary(variantName, game);
  const stackHeight = Math.max(50, Math.min(82, (310 - Math.max(0, suits.length - 1) * 6) / Math.max(1, suits.length) / (286 / 406)));

  return <View style={[styles.surface, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
    <View style={styles.sectionHeader}>
      <Text style={[styles.label, { color: theme.colors.textMuted }]}>FIREWORKS</Text>
      <Text numberOfLines={1} style={[styles.variant, { color: theme.colors.textMuted }]}>{variantName}</Text>
    </View>
    <View style={styles.fireworks}>
      {suits.map((suit) => {
        const stack = game.playStacks[suit.suitIndex] ?? [];
        const topOrder = stack[stack.length - 1];
        const card = topOrder === undefined ? undefined : game.deck[topOrder];
        return <View key={suit.suitIndex} style={styles.firework}>
          {card === undefined
            ? <View style={[styles.emptyStack, { borderColor: theme.colors.borderStrong, height: stackHeight }]} />
            : <VisibleHanabiCard
              height={stackHeight}
              rank={card.rank}
              suitIndex={card.suitIndex}
              variantName={variantName}
            />}
          <Text numberOfLines={1} style={[styles.suitName, { color: theme.colors.textMuted }]}>{suit.suitName}</Text>
        </View>;
      })}
    </View>
    <Pressable
      accessibilityRole={onOpenDiscards === undefined ? undefined : 'button'}
      disabled={onOpenDiscards === undefined}
      onPress={onOpenDiscards}
      style={({ pressed }) => [
        styles.discard,
        { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.border },
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.discardHeader}>
        <Text style={[styles.label, { color: theme.colors.textMuted }]}>DISCARDS</Text>
        <Text style={[styles.discardCount, { color: theme.colors.text }]}>{discard.total}</Text>
      </View>
      {discard.total === 0
        ? <Text style={[styles.emptyText, { color: theme.colors.textMuted }]}>None</Text>
        : <View style={styles.discardRows}>{discard.suits.map((suit) => <View key={suit.suitIndex} style={styles.discardRow}>
          <Text numberOfLines={1} style={[styles.discardSuit, { color: theme.colors.textMuted }]}>{suit.suitName}</Text>
          <View style={styles.rankCounts}>{suit.ranks.map(({ rank, count }) => <View key={rank} style={[styles.rankChip, { borderColor: theme.colors.borderStrong }]}>
            <Text style={[styles.rankText, { color: theme.colors.text }]}>{rank}{count > 1 ? `×${count}` : ''}</Text>
          </View>)}</View>
        </View>)}</View>}
    </Pressable>
  </View>;
}

const styles = StyleSheet.create({
  surface: { borderRadius: 14, borderWidth: 1, gap: 8, padding: 10 },
  sectionHeader: { alignItems: 'center', flexDirection: 'row', gap: 8, justifyContent: 'space-between' },
  label: { fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  variant: { flexShrink: 1, fontSize: 10, fontWeight: '700', textAlign: 'right' },
  fireworks: { alignItems: 'flex-start', flexDirection: 'row', gap: 6, justifyContent: 'center' },
  firework: { alignItems: 'center', flex: 1, gap: 2, minWidth: 0 },
  emptyStack: { aspectRatio: 286 / 406, borderRadius: 7, borderStyle: 'dashed', borderWidth: 2 },
  suitName: { fontSize: 9, fontWeight: '800', maxWidth: '100%' },
  discard: { borderRadius: 10, borderWidth: 1, gap: 5, paddingHorizontal: 8, paddingVertical: 7 },
  discardHeader: { alignItems: 'baseline', flexDirection: 'row', justifyContent: 'space-between' },
  discardCount: { fontSize: 14, fontWeight: '900' },
  discardRows: { gap: 4 },
  discardRow: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  discardSuit: { fontSize: 10, fontWeight: '800', width: 52 },
  rankCounts: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  rankChip: { borderRadius: 6, borderWidth: 1, paddingHorizontal: 5, paddingVertical: 2 },
  rankText: { fontSize: 10, fontWeight: '900' },
  emptyText: { fontSize: 11 },
  pressed: { opacity: 0.82 },
});
