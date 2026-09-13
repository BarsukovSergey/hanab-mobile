import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { GameState } from '../../game/bootstrap/types';
import { getDiscardSummary } from '../../game/selectors/discardSummary';
import { getGameTableSuits } from '../../game/selectors/gameplay';
import { getCardSuitVisuals } from '../../game/selectors/cardVisuals';
import { useAppSelector } from '../../store/hooks';
import { useHanabTheme, useResponsiveLayout } from '../designSystem';
import { VisibleHanabiCard } from './GameCard';
import { AuthoritativePulse } from './AuthoritativePulse';
import { hasUpstreamSvgPip, UpstreamPip } from './UpstreamPip';
import {
  getCompactTableFireworksLayout,
  HANABI_TABLE_CARD_ASPECT_RATIO,
} from './tableLayout';

export function CompactTable({
  game,
  variantName,
  onOpenDiscards,
  dense = false,
  pulseDiscard,
  pulseEnabled = true,
  pulsePlay,
}: {
  game: GameState;
  variantName: string;
  onOpenDiscards?: () => void;
  dense?: boolean;
  pulseDiscard?: number | null;
  pulseEnabled?: boolean;
  pulsePlay?: { segment: number; suitIndex: number } | null;
}) {
  const { theme } = useHanabTheme();
  const { width, height } = useResponsiveLayout();
  const cardIdentities = useAppSelector((state) => (
    state.room.room.kind === 'live_game'
      ? state.room.room.clientState.cardIdentities
      : undefined
  ));
  const landscapePhone = dense || (width > height && height < 700);
  const suits = getGameTableSuits(variantName, game);
  const suitVisuals = getCardSuitVisuals(variantName);
  const discard = getDiscardSummary(variantName, game, cardIdentities);
  const [fireworksWidth, setFireworksWidth] = useState(310);
  const fireworksLayout = getCompactTableFireworksLayout(
    fireworksWidth,
    suits.length,
    landscapePhone,
  );

  return <View style={[
    styles.surface,
    landscapePhone && styles.surfaceLandscape,
    { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
  ]}>
    <View style={styles.sectionHeader}>
      <Text style={[styles.label, { color: theme.colors.textMuted }]}>FIREWORKS</Text>
      {!landscapePhone && <Text numberOfLines={1} style={[styles.variant, { color: theme.colors.textMuted }]}>{variantName}</Text>}
    </View>
    <View
      onLayout={(event) => {
        const nextWidth = event.nativeEvent.layout.width;
        if (nextWidth > 0 && Math.abs(nextWidth - fireworksWidth) > 1) setFireworksWidth(nextWidth);
      }}
      style={[styles.fireworks, { gap: fireworksLayout.gap }]}
    >
      {suits.map((suit) => {
        const stack = game.playStacks[suit.suitIndex] ?? [];
        const topOrder = stack[stack.length - 1];
        const card = topOrder === undefined ? undefined : game.deck[topOrder];
        const visual = suitVisuals[suit.suitIndex];
        return <AuthoritativePulse enabled={pulseEnabled} key={suit.suitIndex} pulseKey={pulsePlay?.suitIndex === suit.suitIndex ? pulsePlay.segment : null}><View style={styles.firework}>
          {card === undefined
            ? <View style={[styles.emptyStack, { borderColor: theme.colors.borderStrong, height: fireworksLayout.stackHeight }]}>
              {visual !== undefined && hasUpstreamSvgPip(visual.pip) && <View style={styles.emptyStackPip}>
                <UpstreamPip
                  duplicatePip={visual.duplicatePip}
                  fillColors={visual.fillColors}
                  pip={visual.pip}
                  size={landscapePhone ? 12 : 15}
                  suitName={visual.name}
                />
              </View>}
            </View>
            : <VisibleHanabiCard
              height={fireworksLayout.stackHeight}
              rank={card.rank}
              suitIndex={card.suitIndex}
              variantName={variantName}
            />}
          {!landscapePhone && <Text numberOfLines={1} style={[styles.suitName, { color: theme.colors.textMuted }]}>{suit.suitName}</Text>}
        </View></AuthoritativePulse>;
      })}
    </View>
    <AuthoritativePulse enabled={pulseEnabled} pulseKey={pulseDiscard ?? null}><Pressable
      accessibilityRole={onOpenDiscards === undefined ? undefined : 'button'}
      disabled={onOpenDiscards === undefined}
      onPress={onOpenDiscards}
      style={({ pressed }) => [
        styles.discard,
        landscapePhone && styles.discardLandscape,
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
        : landscapePhone
          ? <View style={styles.discardLandscapeSummary}>{discard.suits.map((suit) => {
            const visual = suitVisuals[suit.suitIndex];
            return <View key={suit.suitIndex} style={[styles.landscapeSuitToken, { borderColor: theme.colors.borderStrong }]}>
              {visual !== undefined && hasUpstreamSvgPip(visual.pip)
                ? <UpstreamPip duplicatePip={visual.duplicatePip} fillColors={visual.fillColors} pip={visual.pip} size={12} suitName={visual.name} />
                : <Text style={[styles.discardSuitName, { color: theme.colors.textMuted }]}>{compactSuitName(suit.suitName)}</Text>}
              <Text style={[styles.landscapeSuitCount, { color: theme.colors.text }]}>{suit.total}</Text>
            </View>;
          })}</View>
          : <View style={styles.discardSummary}>{discard.suits.map((suit) => {
            const visual = suitVisuals[suit.suitIndex];
            return <View key={suit.suitIndex} style={[styles.discardSuitRow, { borderColor: theme.colors.borderStrong }]}>
              <View style={styles.suitIdentity}>
                {visual !== undefined && hasUpstreamSvgPip(visual.pip)
                  ? <UpstreamPip duplicatePip={visual.duplicatePip} fillColors={visual.fillColors} pip={visual.pip} size={14} suitName={visual.name} />
                  : <Text style={[styles.discardSuitName, { color: theme.colors.textMuted }]}>{compactSuitName(suit.suitName)}</Text>}
              </View>
              <View style={styles.rankChips}>{suit.ranks.map(({ rank, count }) => (
                <View key={rank} style={[styles.rankChip, { backgroundColor: theme.colors.surfaceRaised, borderColor: theme.colors.borderStrong }]}>
                  <Text style={[styles.rankChipRank, { color: theme.colors.text }]}>{rank}</Text>
                  {count > 1 && <Text style={[styles.rankChipCount, { color: theme.colors.textMuted }]}>×{count}</Text>}
                </View>
              ))}
              {suit.unknownCount > 0 && <View style={[styles.rankChip, { backgroundColor: theme.colors.surfaceRaised, borderColor: theme.colors.borderStrong }]}>
                <Text style={[styles.rankChipRank, { color: theme.colors.text }]}>?</Text>
                {suit.unknownCount > 1 && <Text style={[styles.rankChipCount, { color: theme.colors.textMuted }]}>×{suit.unknownCount}</Text>}
              </View>}
              </View>
            </View>;
          })}</View>}
    </Pressable></AuthoritativePulse>
  </View>;
}

function compactSuitName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length <= 5) return trimmed;
  return trimmed.slice(0, 3).toUpperCase();
}

const styles = StyleSheet.create({
  surface: { borderRadius: 12, borderWidth: 1, gap: 5, padding: 7 },
  surfaceLandscape: { gap: 3, padding: 5 },
  sectionHeader: { alignItems: 'center', flexDirection: 'row', gap: 8, justifyContent: 'space-between' },
  label: { fontSize: 9, fontWeight: '900', letterSpacing: 0.7 },
  variant: { flexShrink: 1, fontSize: 9, fontWeight: '700', textAlign: 'right' },
  fireworks: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'center', width: '100%' },
  firework: { alignItems: 'center', flex: 1, gap: 1, minWidth: 0 },
  emptyStack: { alignItems: 'center', aspectRatio: HANABI_TABLE_CARD_ASPECT_RATIO, borderRadius: 6, borderStyle: 'dashed', borderWidth: 2, justifyContent: 'center' },
  emptyStackPip: { opacity: 0.52 },
  suitName: { fontSize: 7, fontWeight: '800', maxWidth: '100%' },
  discard: { borderRadius: 9, borderWidth: 1, gap: 4, paddingHorizontal: 7, paddingVertical: 5 },
  discardLandscape: { gap: 2, paddingHorizontal: 6, paddingVertical: 3 },
  discardHeader: { alignItems: 'baseline', flexDirection: 'row', justifyContent: 'space-between' },
  discardCount: { fontSize: 12, fontWeight: '900' },
  discardSummary: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  discardLandscapeSummary: { alignItems: 'center', flexDirection: 'row', flexWrap: 'nowrap', gap: 3 },
  discardSuitRow: { alignItems: 'center', borderRadius: 7, borderWidth: 1, flexDirection: 'row', gap: 4, maxWidth: '49%', minHeight: 23, paddingHorizontal: 5, paddingVertical: 2 },
  landscapeSuitToken: { alignItems: 'center', borderRadius: 6, borderWidth: 1, flexDirection: 'row', gap: 2, minHeight: 19, paddingHorizontal: 4, paddingVertical: 2 },
  landscapeSuitCount: { fontSize: 8, fontWeight: '900' },
  suitIdentity: { alignItems: 'center', justifyContent: 'center', minWidth: 18 },
  discardSuitName: { fontSize: 8, fontWeight: '900' },
  rankChips: { alignItems: 'center', flexDirection: 'row', flexShrink: 1, flexWrap: 'wrap', gap: 2 },
  rankChip: { alignItems: 'baseline', borderRadius: 5, borderWidth: 1, flexDirection: 'row', gap: 1, minWidth: 20, paddingHorizontal: 3, paddingVertical: 1 },
  rankChipRank: { fontSize: 9, fontWeight: '900' },
  rankChipCount: { fontSize: 7, fontWeight: '800' },
  emptyText: { fontSize: 9 },
  pressed: { opacity: 0.82 },
});
