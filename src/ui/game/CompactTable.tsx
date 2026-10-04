import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import type { GameState } from '../../game/bootstrap/types';
import type { ClueResourceCue, DiscardResourceCue } from '../../game/selectors/gameResourcePresentation';
import { getDiscardPresentation } from '../../game/selectors/discardPresentation';
import { getDisplayedClueTokens } from '../../game/selectors/gameplay';
import { getDiscardSummary } from '../../game/selectors/discardSummary';
import { getGameTableSuits } from '../../game/selectors/gameplay';
import { getCardSuitVisuals } from '../../game/selectors/cardVisuals';
import { useAppSelector } from '../../store/hooks';
import { useHanabTheme, useResponsiveLayout } from '../designSystem';
import { getPortraitResourceRailFit } from './c17DenseLayout';
import { VisibleHanabiCard } from './GameCard';
import { AuthoritativePulse } from './AuthoritativePulse';
import { hasUpstreamSvgPip, UpstreamPip } from './UpstreamPip';
import {
  getCompactTableFireworksLayout,
  getCompactTableFireworkCellWidth,
  HANABI_TABLE_CARD_ASPECT_RATIO,
} from './tableLayout';

type LandscapeResourceFeedback = {
  before: GameState | undefined;
  segment: number | null;
  clueCue: ClueResourceCue;
  lowScorePhase: boolean;
  colorblindMode: boolean;
};

export function CompactTable({
  game,
  discardResourceCue = 'default',
  variantName,
  onOpenDiscards,
  dense = false,
  presentation = 'legacy',
  tightChrome = false,
  pulseDiscard,
  pulseEnabled = true,
  pulsePlay,
  landscapeResourceFeedback,
}: {
  game: GameState;
  landscapeResourceFeedback?: LandscapeResourceFeedback;
  discardResourceCue?: DiscardResourceCue;
  variantName: string;
  onOpenDiscards?: () => void;
  dense?: boolean;
  presentation?: 'legacy' | 'portrait-v2' | 'landscape-v2';
  tightChrome?: boolean;
  pulseDiscard?: number | null;
  pulseEnabled?: boolean;
  pulsePlay?: { segment: number; suitIndex: number } | null;
}) {
  const { theme } = useHanabTheme();
  const { width, height } = useResponsiveLayout();
  const { fontScale } = useWindowDimensions();
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

  if (presentation !== 'legacy') return <V2Table landscape={presentation === 'landscape-v2'} game={game} variantName={variantName}
    cardIdentities={cardIdentities} discardResourceCue={discardResourceCue} onOpenDiscards={onOpenDiscards}
    fontScale={fontScale} pulseDiscard={pulseDiscard} pulseEnabled={pulseEnabled} pulsePlay={pulsePlay}
    resourceFeedback={landscapeResourceFeedback} />;

  return <View style={[
    styles.surface,
    landscapePhone && styles.surfaceLandscape,
    tightChrome && styles.surfaceTight,
    { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
  ]}>
    {!tightChrome && <View style={styles.sectionHeader}>
      <Text style={[styles.label, { color: theme.colors.textMuted }]}>FIREWORKS</Text>
      {!landscapePhone && <Text numberOfLines={1} style={[styles.variant, { color: theme.colors.textMuted }]}>{variantName}</Text>}
    </View>}
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
        return <View key={suit.suitIndex} style={[styles.firework, { width: getCompactTableFireworkCellWidth(fireworksLayout.stackWidth) }]}>
          <AuthoritativePulse enabled={pulseEnabled} pulseKey={pulsePlay?.suitIndex === suit.suitIndex ? pulsePlay.segment : null}>
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
          </AuthoritativePulse>
          {!landscapePhone && <Text numberOfLines={1} style={[styles.suitName, { color: theme.colors.textMuted }]}>{suit.suitName}</Text>}
        </View>;
      })}
    </View>
    <AuthoritativePulse enabled={pulseEnabled} pulseKey={pulseDiscard ?? null}><Pressable
      accessibilityRole={onOpenDiscards === undefined ? undefined : 'button'}
      accessibilityLabel={discardResourceCue === 'blocked'
        ? 'Discards. Unavailable because clues are at maximum'
        : discardResourceCue === 'double-discard' ? 'Discards. Potential Double Discard' : 'Discards'}
      disabled={onOpenDiscards === undefined}
      onPress={onOpenDiscards}
      style={({ pressed }) => [
        styles.discard,
        landscapePhone && styles.discardLandscape,
        { backgroundColor: theme.colors.surfaceMuted, borderColor: discardResourceCue === 'blocked'
          ? '#ff5555' : discardResourceCue === 'double-discard' ? '#ffd54f' : theme.colors.border },
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

function V2Table({ landscape, game, variantName, cardIdentities, discardResourceCue, onOpenDiscards,
  fontScale, pulseDiscard, pulseEnabled, pulsePlay, resourceFeedback }: {
  landscape: boolean; game: GameState; variantName: string;
  resourceFeedback?: LandscapeResourceFeedback;
  cardIdentities?: readonly import('../../game/bootstrap/types').CardIdentity[];
  discardResourceCue: DiscardResourceCue; onOpenDiscards?: () => void;
  fontScale: number; pulseDiscard?: number | null; pulseEnabled: boolean;
  pulsePlay?: { segment: number; suitIndex: number } | null;
}) {
  const { theme } = useHanabTheme();
  const [availableWidth, setAvailableWidth] = useState(0);
  const suits = getGameTableSuits(variantName, game);
  const visuals = getCardSuitVisuals(variantName);
  const lateralRail = landscape || getPortraitResourceRailFit(availableWidth, suits.length, fontScale);
  const resourceRail = landscape ? 58 : Math.max(64, Math.ceil(64 * Math.min(fontScale, 1.5)));
  const stackWidth = Math.max(30, Math.min(40, (availableWidth - 42 - 28 - (lateralRail ? resourceRail : 0)) / Math.max(1, suits.length)));
  const stackHeight = landscape ? 30 : stackWidth / HANABI_TABLE_CARD_ASPECT_RATIO;
  const discard = getDiscardPresentation(game, cardIdentities);
  const resourcePulse = (before: number | undefined, after: number) => landscape && before !== undefined && before !== after
    ? resourceFeedback?.segment ?? null : null;
  const clueColor = !landscape ? theme.colors.text
    : resourceFeedback?.clueCue === 'no-clues' ? '#ff5555'
    : resourceFeedback?.clueCue === 'one-clue' ? '#ffd54f'
    : resourceFeedback?.clueCue === 'max-clues' ? '#aaff00' : theme.colors.text;
  const resources = <View style={{ minWidth: resourceRail, gap: 3, flexDirection: lateralRail ? 'column' : 'row', alignItems: 'center' }}>
    <AuthoritativePulse enabled={pulseEnabled} pulseKey={resourcePulse(resourceFeedback?.before?.clueTokens, game.clueTokens)}><Text numberOfLines={landscape ? 1 : undefined} style={{ color: clueColor, ...(landscape ? { fontSize: 10 } : {}) }}>Clues {getDisplayedClueTokens(game.clueTokens, variantName)}</Text></AuthoritativePulse>
    <AuthoritativePulse enabled={pulseEnabled} pulseKey={resourcePulse(resourceFeedback?.before?.strikes.length, game.strikes.length)}><View accessibilityLabel={`Strikes ${game.strikes.length}`} style={{ flexDirection: 'row', gap: 3 }}>
      {[0, 1, 2].map((slot) => <View key={slot} style={{ width: landscape ? 12 : 16, height: landscape ? 12 : 16, borderWidth: 1, borderColor: theme.colors.borderStrong, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: theme.colors.text, fontSize: landscape ? 9 : 12 }}>{slot < game.strikes.length ? '\u00d7' : ''}</Text>
      </View>)}
    </View></AuthoritativePulse>
  </View>;
  return <View onLayout={(event) => setAvailableWidth(event.nativeEvent.layout.width)} style={{ gap: 4, ...(landscape ? { height: 92, flexShrink: 0 } : {}) }}>
    <View style={[styles.surface, { ...(landscape ? { height: 62, gap: 0 } : {}), padding: landscape ? 3 : 6, backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
      <AuthoritativePulse enabled={pulseEnabled} pulseKey={resourcePulse(resourceFeedback?.before?.score, game.score)}><Text style={{ color: landscape && resourceFeedback?.lowScorePhase ? '#00ffff' : theme.colors.text, ...(landscape && resourceFeedback?.lowScorePhase && resourceFeedback.colorblindMode ? { textDecorationLine: 'underline' as const } : {}), fontSize: landscape ? 10 : 12, fontWeight: '700' }}>Score {game.score} / {game.stats.maxScore}</Text></AuthoritativePulse>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <View style={{ flexDirection: 'row', gap: 2, flex: 1 }}>
          {suits.map((suit) => {
            const order = game.playStacks[suit.suitIndex]?.at(-1);
            const card = order === undefined ? undefined : game.deck[order];
            const visual = visuals[suit.suitIndex];
            return <AuthoritativePulse key={suit.suitIndex} enabled={pulseEnabled} pulseKey={pulsePlay?.suitIndex === suit.suitIndex ? pulsePlay.segment : null}>
              {card ? <VisibleHanabiCard height={stackHeight} rank={card.rank} suitIndex={card.suitIndex} variantName={variantName} />
                : <View style={[styles.emptyStack, { height: stackHeight, borderColor: theme.colors.borderStrong }]}>
                  {visual && hasUpstreamSvgPip(visual.pip) && <UpstreamPip duplicatePip={visual.duplicatePip} fillColors={visual.fillColors} pip={visual.pip} size={14} suitName={visual.name} />}
                </View>}
            </AuthoritativePulse>;
          })}
        </View>
        {lateralRail && resources}
        <AuthoritativePulse enabled={pulseEnabled} pulseKey={resourcePulse(resourceFeedback?.before?.cardsRemainingInTheDeck, game.cardsRemainingInTheDeck)}><View accessible accessibilityLabel={`Deck ${game.cardsRemainingInTheDeck}`} style={{ width: landscape ? 34 : 42, minHeight: landscape ? 30 : 42, borderWidth: 1, borderRadius: 5, borderColor: theme.colors.borderStrong, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: theme.colors.text, fontSize: 10 }}>Deck</Text>
          <Text style={{ color: theme.colors.text, fontWeight: '700', ...(landscape ? { fontSize: 12 } : {}) }}>{game.cardsRemainingInTheDeck}</Text>
        </View></AuthoritativePulse>
      </View>
      {!lateralRail && resources}
    </View>
    <AuthoritativePulse enabled={pulseEnabled} pulseKey={pulseDiscard ?? null}>
      <Pressable accessibilityRole="button" accessibilityLabel={discardResourceCue === 'blocked' ? 'Discard Pile. Unavailable because clues are at maximum' : discardResourceCue === 'double-discard' ? 'Discard Pile. Potential Double Discard' : 'Discard Pile'} onPress={onOpenDiscards} style={[styles.discard, landscape && { height: 26, padding: 2, flexDirection: 'row', alignItems: 'center', gap: 4 }, { backgroundColor: theme.colors.surfaceMuted, borderColor: discardResourceCue === 'blocked' ? '#ff5555' : discardResourceCue === 'double-discard' ? '#ffd54f' : theme.colors.border }]}>
        <Text style={{ color: theme.colors.text, fontSize: landscape ? 10 : 11, fontWeight: '700' }}>Discard Pile</Text>
        {discard.cards.length === 0 ? <Text style={{ color: theme.colors.textMuted, ...(landscape ? { fontSize: 10 } : {}) }}>None</Text>
          : discard.relevantCards.length === 0 ? <Text style={{ color: theme.colors.textMuted, ...(landscape ? { fontSize: 10 } : {}) }}>No relevant cards</Text>
          : <ScrollView horizontal nestedScrollEnabled contentContainerStyle={{ gap: 3 }}>
            {discard.relevantCards.map((card) => <VisibleHanabiCard key={card.order} height={landscape ? 20 : 32} rank={card.rank} suitIndex={card.suitIndex} variantName={variantName} />)}
          </ScrollView>}
      </Pressable>
    </AuthoritativePulse>
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
  surfaceTight: { gap: 2, padding: 4 },
  sectionHeader: { alignItems: 'center', flexDirection: 'row', gap: 8, justifyContent: 'space-between' },
  label: { fontSize: 9, fontWeight: '900', letterSpacing: 0.7 },
  variant: { flexShrink: 1, fontSize: 9, fontWeight: '700', textAlign: 'right' },
  fireworks: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'center', width: '100%' },
  firework: { alignItems: 'center', gap: 1, minWidth: 0 },
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
