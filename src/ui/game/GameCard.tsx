import { useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { getVariant } from '../../game/upstream/gameData';
import type { CardKnowledgeViewModel } from '../../game/selectors/cardKnowledge';
import { getCardSuitVisuals, type CardSuitVisual } from '../../game/selectors/cardVisuals';
import { useHanabTheme } from '../designSystem';
import type { ClueCardMarker } from './clueIndication';
import { UpstreamCardFace } from './UpstreamCardFace';
import { hasUpstreamSvgPip, UpstreamPip } from './UpstreamPip';

type GameCardProps = {
  position: number;
  knowledge: CardKnowledgeViewModel;
  selected: boolean;
  highlighted?: boolean;
  clueMarker?: ClueCardMarker | null;
  hasNote?: boolean;
  height?: number;
  onSelect: () => void;
  onLongPress?: () => void;
  onPressOut?: () => void;
  variantName: string;
};

type VisibleCardSize = 'hand' | 'table' | 'mini';

export function GameCard({
  position,
  knowledge,
  selected,
  highlighted = false,
  clueMarker = null,
  hasNote = false,
  height,
  onSelect,
  onLongPress,
  onPressOut,
  variantName,
}: GameCardProps) {
  const { theme } = useHanabTheme();
  const longPressed = useRef(false);

  return <Pressable
    accessibilityLabel={`Card ${position + 1}${hasNote ? ', has note' : ''}`}
    accessibilityRole="button"
    accessibilityState={{ selected }}
    delayLongPress={350}
    onLongPress={onLongPress === undefined ? undefined : () => {
      longPressed.current = true;
      onLongPress();
    }}
    onPress={() => {
      if (longPressed.current) {
        longPressed.current = false;
        return;
      }
      onSelect();
    }}
    onPressIn={() => { longPressed.current = false; }}
    onPressOut={onPressOut}
    style={({ pressed }) => [styles.cardTouch, pressed && styles.pressed]}
  >
    <View style={[
      styles.hiddenFrame,
      height === undefined ? null : { height, width: undefined },
      { borderColor: selected ? theme.colors.accent : '#0d0d0d' },
      selected && styles.selectedFrame,
    ]}>
      <View style={styles.hiddenCard}>
        <UpstreamCardFace rank={knowledge.displayRank} suitIndex={knowledge.displaySuitIndex} variantName={variantName} />
        {knowledge.borderColor !== null && <View pointerEvents="none" style={[styles.semanticInset, { borderColor: knowledge.borderColor }]} />}
        {highlighted && <View pointerEvents="none" style={[styles.previewInset, { borderColor: theme.colors.warning }]} />}
        <HiddenKnowledgeOverlay height={height} knowledge={knowledge} variantName={variantName} />
        {clueMarker !== null && <CommittedClueMarker marker={clueMarker} variantName={variantName} />}
        {hasNote && <NoteIndicator compact={height !== undefined && height < 80} />}
      </View>
    </View>
  </Pressable>;
}

export function VisibleHanabiCard({
  suitIndex,
  rank,
  variantName,
  position,
  selected = false,
  highlighted = false,
  clueMarker = null,
  hasNote = false,
  semanticBorder = null,
  empathyKnowledge = null,
  onPress,
  onLongPress,
  onPressOut,
  size = 'hand',
  height,
}: {
  suitIndex: number | null;
  rank: number | null;
  variantName: string;
  position?: number;
  selected?: boolean;
  highlighted?: boolean;
  clueMarker?: ClueCardMarker | null;
  hasNote?: boolean;
  semanticBorder?: string | null;
  empathyKnowledge?: CardKnowledgeViewModel | null;
  onPress?: () => void;
  onLongPress?: () => void;
  onPressOut?: () => void;
  size?: VisibleCardSize;
  height?: number;
}) {
  const { theme } = useHanabTheme();
  const longPressed = useRef(false);
  const empathyActive = empathyKnowledge !== null;
  const faceSuitIndex = empathyActive ? empathyKnowledge.displaySuitIndex : suitIndex;
  const faceRank = empathyActive ? empathyKnowledge.displayRank : rank;
  const suits = getCardSuitVisuals(variantName);
  const suit = faceSuitIndex === null ? undefined : suits[faceSuitIndex];
  const sizeStyles = size === 'mini' ? styles.visibleMini : size === 'table' ? styles.visibleTable : styles.visibleHand;
  const compactIndicator = size === 'mini' || (height !== undefined && height < 80);
  const activeSemanticBorder = empathyActive ? empathyKnowledge.borderColor : semanticBorder;

  const content = <View style={[
    styles.visibleCard,
    sizeStyles,
    height === undefined ? null : { height },
    empathyActive && styles.empathyCard,
    {
      borderColor: selected ? theme.colors.accent : 'transparent',
      borderWidth: selected ? 5 : 0,
    },
  ]}>
    <UpstreamCardFace rank={faceRank} suitIndex={faceSuitIndex} variantName={variantName} />
    {activeSemanticBorder !== null && size === 'hand' && <View pointerEvents="none" style={[styles.semanticInset, { borderColor: activeSemanticBorder }]} />}
    {empathyActive && <HiddenKnowledgeOverlay height={height} knowledge={empathyKnowledge} variantName={variantName} />}
    {highlighted && <View pointerEvents="none" style={[styles.previewInset, { borderColor: theme.colors.warning }]} />}
    {clueMarker !== null && <CommittedClueMarker marker={clueMarker} variantName={variantName} />}
    {hasNote && <NoteIndicator compact={compactIndicator} />}
  </View>;

  if (onPress === undefined && onLongPress === undefined && onPressOut === undefined) return content;
  return <Pressable
    accessibilityLabel={`${position === undefined ? '' : `Card ${position + 1}, `}${suit?.name ?? 'Unknown'} ${faceRank ?? 'unknown'}${hasNote ? ', has note' : ''}`}
    accessibilityRole="button"
    accessibilityState={{ selected }}
    delayLongPress={350}
    onLongPress={onLongPress === undefined ? undefined : () => {
      longPressed.current = true;
      onLongPress();
    }}
    onPress={onPress === undefined ? undefined : () => {
      if (longPressed.current) {
        longPressed.current = false;
        return;
      }
      onPress();
    }}
    onPressIn={() => { longPressed.current = false; }}
    onPressOut={onPressOut}
    style={({ pressed }) => pressed && styles.pressed}
  >{content}</Pressable>;
}

export function CardKnowledgeDetails({ knowledge, variantName }: { knowledge: CardKnowledgeViewModel; variantName: string }) {
  const { theme } = useHanabTheme();
  return <View style={styles.details}>
    {!knowledge.hasClueApplied && <Text style={[styles.detailMuted, { color: theme.colors.textMuted }]}>No clue information</Text>}
    <KnowledgeSuitLegend knowledge={knowledge} variantName={variantName} />
    <KnowledgeRankLegend knowledge={knowledge} />
  </View>;
}

function HiddenKnowledgeOverlay({ knowledge, variantName, height }: { knowledge: CardKnowledgeViewModel; variantName: string; height?: number }) {
  const suits = getCardSuitVisuals(variantName);
  const scale = Math.max(0.58, Math.min(1, (height ?? 112) / 112));
  const pipSize = Math.max(11, Math.round(16 * scale));
  const pipBox = Math.max(13, pipSize + 1);
  const rankFontSize = Math.max(8, Math.round(10 * scale));
  const rankBox = Math.max(10, Math.round(12 * scale));
  const visibleSuits = knowledge.suitPips.filter((pipState) => pipState.state !== 'hidden');
  const visibleRanks = knowledge.rankPips.filter((pipState) => pipState.state !== 'hidden');

  return <View pointerEvents="none" style={styles.knowledgeOverlay}>
    {visibleSuits.length > 0 && <View style={[styles.knowledgeStrip, styles.suitStrip]}>
      {visibleSuits.map((pipState) => {
        const suit = suits[pipState.suitIndex];
        if (suit === undefined || !hasUpstreamSvgPip(suit.pip)) return null;
        return <View key={`suit-${pipState.suitIndex}`} style={[styles.knowledgeToken, { height: pipBox, width: pipBox }]}>
          {pipState.positive && <View style={[styles.positiveSuitHalo, { borderRadius: pipBox / 2, height: pipBox, width: pipBox }]} />}
          <UpstreamPip
            duplicatePip={suit.duplicatePip}
            fillColors={suit.fillColors}
            pip={suit.pip}
            size={pipSize}
            suitName={suit.name}
          />
          {pipState.state === 'eliminated' && <EliminationX size={pipBox} />}
        </View>;
      })}
    </View>}
    {visibleRanks.length > 0 && <View style={[styles.knowledgeStrip, styles.rankStrip]}>
      {visibleRanks.map((pipState) => <View key={`rank-${pipState.rank}`} style={[styles.rankToken, { height: rankBox, width: rankBox }]}>
        <Text style={[styles.hiddenRankText, { fontSize: rankFontSize, lineHeight: rankFontSize + 1 }, pipState.positive && styles.positiveRankText]}>{pipState.rank}</Text>
        {pipState.state === 'eliminated' && <EliminationX size={Math.max(9, Math.round(rankBox * 0.85))} />}
      </View>)}
    </View>}
  </View>;
}

function CommittedClueMarker({ marker, variantName }: { marker: ClueCardMarker; variantName: string }) {
  const arrowColor = marker.retouched ? '#737373' : '#ffffff';
  const clueColor = marker.kind === 'color'
    ? getVariant(variantName).clueColors[marker.value]?.fill ?? '#ffffff'
    : null;
  return <View pointerEvents="none" style={styles.clueMarker}>
    <Text style={[styles.clueArrow, { color: arrowColor }]}>↓</Text>
    <View style={[
      styles.clueCircle,
      marker.kind === 'rank' ? styles.rankClueCircle : { backgroundColor: clueColor },
    ]}>
      {marker.kind === 'rank' && <Text numberOfLines={1} style={styles.rankClueText}>{marker.label}</Text>}
    </View>
  </View>;
}

function EliminationX({ size = 20 }: { size?: number }) {
  const thickness = Math.max(2, Math.round(size * 0.12));
  return <View pointerEvents="none" style={{ height: size, left: '50%', marginLeft: -size / 2, marginTop: -size / 2, position: 'absolute', top: '50%', width: size }}>
    <View style={[styles.eliminationStroke, { height: thickness, top: (size - thickness) / 2, width: size }, styles.eliminationSlash]} />
    <View style={[styles.eliminationStroke, { height: thickness, top: (size - thickness) / 2, width: size }, styles.eliminationBackslash]} />
  </View>;
}

function SuitMarker({ suit, compact = false }: { suit: CardSuitVisual; compact?: boolean }) {
  if (!hasUpstreamSvgPip(suit.pip)) return null;
  return <UpstreamPip
    duplicatePip={suit.duplicatePip}
    fillColors={suit.fillColors}
    pip={suit.pip}
    size={compact ? 13 : 22}
    suitName={suit.name}
  />;
}

function KnowledgeSuitLegend({ knowledge, variantName }: { knowledge: CardKnowledgeViewModel; variantName: string }) {
  const suits = getCardSuitVisuals(variantName);
  return <View style={styles.knowledgeRow}>{knowledge.suitPips.filter((pipState) => pipState.state !== 'hidden').map((pipState) => {
    const suit = suits[pipState.suitIndex];
    if (suit === undefined) return null;
    return <View key={suit.name} style={styles.legendPip}>
      <SuitMarker suit={suit} compact />
      {pipState.state === 'eliminated' && <EliminationX size={18} />}
    </View>;
  })}</View>;
}

function KnowledgeRankLegend({ knowledge }: { knowledge: CardKnowledgeViewModel }) {
  return <View style={styles.knowledgeRow}>{knowledge.rankPips.filter((pipState) => pipState.state !== 'hidden').map((pipState) => (
    <View key={pipState.rank} style={styles.legendRank}>
      <Text style={[styles.rankPipText, pipState.positive && styles.positiveRankText]}>{pipState.rank}</Text>
      {pipState.state === 'eliminated' && <EliminationX size={16} />}
    </View>
  ))}</View>;
}

function NoteIndicator({ compact = false }: { compact?: boolean }) {
  return <View style={[styles.noteIndicator, compact && styles.noteIndicatorCompact]}>
    <Text style={[styles.noteIndicatorText, compact && styles.noteIndicatorTextCompact]}>✎</Text>
  </View>;
}

const styles = StyleSheet.create({
  cardTouch: { alignItems: 'center' },
  pressed: { opacity: 0.82 },
  hiddenFrame: { aspectRatio: 286 / 406, backgroundColor: '#0d0d0d', borderRadius: 8, borderWidth: 2, elevation: 2, shadowColor: '#000000', shadowOffset: { width: 2, height: 2 }, shadowOpacity: 0.28, shadowRadius: 2, width: 88 },
  selectedFrame: { borderWidth: 4 },
  hiddenCard: { backgroundColor: '#747a76', borderRadius: 5, flex: 1, margin: 1, overflow: 'hidden' },
  empathyCard: { backgroundColor: '#747a76' },
  knowledgeOverlay: { bottom: 0, justifyContent: 'space-between', left: 0, paddingBottom: '10%', paddingHorizontal: '8%', paddingTop: '42%', position: 'absolute', right: 0, top: 0 },
  knowledgeStrip: { alignItems: 'center', flexDirection: 'row', justifyContent: 'center' },
  suitStrip: { gap: 1 },
  rankStrip: { gap: 0 },
  knowledgeToken: { alignItems: 'center', justifyContent: 'center', position: 'relative' },
  rankToken: { alignItems: 'center', justifyContent: 'center', position: 'relative' },
  hiddenRankText: { color: '#f7f7f3', fontFamily: 'Arial', fontWeight: '900', textShadowColor: '#000000', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 1 },
  positiveRankText: { color: 'orange' },
  positiveSuitHalo: { backgroundColor: 'rgba(238, 188, 29, 0.16)', borderColor: 'rgba(13, 13, 13, 0.55)', borderWidth: 1, left: 0, position: 'absolute', top: 0 },
  eliminationStroke: { backgroundColor: '#111111', left: 0, position: 'absolute' },
  eliminationSlash: { transform: [{ rotate: '45deg' }] },
  eliminationBackslash: { transform: [{ rotate: '-45deg' }] },
  knowledgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, justifyContent: 'center' },
  legendPip: { alignItems: 'center', height: 24, justifyContent: 'center', position: 'relative', width: 24 },
  legendRank: { alignItems: 'center', height: 20, justifyContent: 'center', position: 'relative', width: 20 },
  rankPipText: { color: '#ffffff', fontSize: 13, fontWeight: '900', textShadowColor: '#000000', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 1 },
  visibleCard: { aspectRatio: 286 / 406, backgroundColor: 'transparent', borderRadius: 7, elevation: 2, justifyContent: 'center', overflow: 'hidden', shadowColor: '#000000', shadowOffset: { width: 2, height: 2 }, shadowOpacity: 0.26, shadowRadius: 2 },
  visibleHand: { height: 112 },
  visibleTable: { height: 86 },
  visibleMini: { borderRadius: 5, height: 56 },
  semanticInset: { bottom: 0, borderRadius: 5, borderWidth: 3, left: 0, position: 'absolute', right: 0, top: 0, zIndex: 3 },
  previewInset: { bottom: 0, borderRadius: 5, borderWidth: 3, left: 0, position: 'absolute', right: 0, top: 0, zIndex: 7 },
  clueMarker: { alignItems: 'center', left: 3, position: 'absolute', top: 1, zIndex: 9 },
  clueArrow: { fontSize: 14, fontWeight: '900', lineHeight: 13, textShadowColor: '#000000', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 1 },
  clueCircle: { alignItems: 'center', borderColor: '#111111', borderRadius: 7, borderWidth: 1, height: 14, justifyContent: 'center', width: 14 },
  rankClueCircle: { backgroundColor: '#111111', borderColor: '#ffffff' },
  rankClueText: { color: '#ffffff', fontSize: 8, fontWeight: '900', lineHeight: 9, maxWidth: 11 },
  noteIndicator: { alignItems: 'center', backgroundColor: '#d8d5ef', borderColor: '#0d0d0d', borderRadius: 3, borderWidth: 1, height: 16, justifyContent: 'center', position: 'absolute', right: 4, top: 4, transform: [{ rotate: '-8deg' }], width: 16, zIndex: 10 },
  noteIndicatorCompact: { height: 11, right: 2, top: 2, width: 11 },
  noteIndicatorText: { color: '#0d0d0d', fontSize: 11, fontWeight: '900', lineHeight: 12 },
  noteIndicatorTextCompact: { fontSize: 7, lineHeight: 8 },
  details: { gap: 5 },
  detailMuted: { fontSize: 11, fontStyle: 'italic' },
});
