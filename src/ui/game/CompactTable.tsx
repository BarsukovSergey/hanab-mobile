import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { GameState } from '../../game/bootstrap/types';
import { getDiscardSummary } from '../../game/selectors/discardSummary';
import { getGameTableSuits } from '../../game/selectors/gameplay';
import { useHanabTheme } from '../designSystem';
import { VisibleHanabiCard } from './GameCard';

const CARD_ASPECT_RATIO = 286 / 406;

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
  const [fireworksWidth, setFireworksWidth] = useState(310);
  const gaps = Math.max(0, suits.length - 1) * 5;
  const cardWidth = Math.max(30, (fireworksWidth - gaps) / Math.max(1, suits.length));
  const stackHeight = Math.max(46, Math.min(82, cardWidth / CARD_ASPECT_RATIO));

  return <View style={[styles.surface, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
    <View style={styles.sectionHeader}>
      <Text style={[styles.label, { color: theme.colors.textMuted }]}>FIREWORKS</Text>
      <Text numberOfLines={1} style={[styles.variant, { color: theme.colors.textMuted }]}>{variantName}</Text>
    </View>
    <View
      onLayout={(event) => {
        const nextWidth = event.nativeEvent.layout.width;
        if (nextWidth > 0 && Math.abs(nextWidth - fireworksWidth) > 1) setFireworksWidth(nextWidth);
      }}
      style={styles.fireworks}
    >
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
        : <View style={styles.discardSummary}>{discard.suits.map((suit) => {
          const ranks = suit.ranks.map(({ rank, count }) => `${rank}${count > 1 ? `×${count}` : ''}`).join(' ');
          return <View key={suit.suitIndex} style={[styles.suitChip, { borderColor: theme.colors.borderStrong }]}>
            <Text numberOfLines={1} style={[styles.suitChipText, { color: theme.colors.text }]}>{suit.suitName} {ranks}</Text>
          </View>;
        })}</View>}
    </Pressable>
  </View>;
}

const styles = StyleSheet.create({
  surface: { borderRadius: 14, borderWidth: 1, gap: 7, padding: 9 },
  sectionHeader: { alignItems: 'center', flexDirection: 'row', gap: 8, justifyContent: 'space-between' },
  label: { fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  variant: { flexShrink: 1, fontSize: 10, fontWeight: '700', textAlign: 'right' },
  fireworks: { alignItems: 'flex-start', flexDirection: 'row', gap: 5, justifyContent: 'center', width: '100%' },
  firework: { alignItems: 'center', flex: 1, gap: 2, minWidth: 0 },
  emptyStack: { aspectRatio: CARD_ASPECT_RATIO, borderRadius: 7, borderStyle: 'dashed', borderWidth: 2 },
  suitName: { fontSize: 8, fontWeight: '800', maxWidth: '100%' },
  discard: { borderRadius: 10, borderWidth: 1, gap: 4, paddingHorizontal: 8, paddingVertical: 6 },
  discardHeader: { alignItems: 'baseline', flexDirection: 'row', justifyContent: 'space-between' },
  discardCount: { fontSize: 13, fontWeight: '900' },
  discardSummary: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  suitChip: { borderRadius: 6, borderWidth: 1, maxWidth: '48%', paddingHorizontal: 5, paddingVertical: 2 },
  suitChipText: { fontSize: 9, fontWeight: '800' },
  emptyText: { fontSize: 10 },
  pressed: { opacity: 0.82 },
});
