import { useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

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
        {clueMarker !== null && <CommittedClueMarker marker={clueMarker} />}
        {hasNote && <NoteIndicator compact={height !== undefined && height < 80} />}
        <Text style={styles.cardPosition}>{position + 1}</Text>
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
    {clueMarker !== null && <CommittedClueMarker marker={clueMarker} />}
    {hasNote && <NoteIndicator compact={compactIndicator} />}
    {empathyActive && position !== undefined && <Text style={styles.cardPosition}>{position + 1}</Text>}
  </View>;

  if (onPress === undefined && onLongPress === undefined && onPressOut === undefined) return content;
  return <Pressable
    accessibilityLabel={`${suit?.name ?? 'Unknown'} ${faceRank ?? 'unknown'}${hasNote ? ', has note' : ''}`}
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
  const suitCount = Math.max(knowledge.suitPips.length, 1);
  const scale = Math.max(0.58, Math.min(1, (height ?? 112) / 112));
  const pipSize = Math.round(22 * scale);
  const pipBox = Math.max(16, pipSize + 2);
  const rankFontSize = Math.max(10, Math.round(15 * scale));
  const rankBoxWidth = Math.max(10, Math.round(13 * scale));
  return <View pointerEvents="none" style={StyleSheet.absoluteFill}>
    {knowledge.suitPips.map((pipState) => {
      if (pipState.state === 'hidden') return null;
      const suit = suits[pipState.suitIndex];
      if (suit === undefined || !hasUpstreamSvgPip(suit.pip)) return null;
      const angle = (-pipState.suitIndex / suitCount + 0.25) * Math.PI * 2;
      const left = 50 - 25 * Math.cos(angle);
      const top = 46 - 18 * Math.sin(angle);
      return <View
        key={`suit-${pipState.suitIndex}`}
        style={[styles.hiddenSuitPip, {
          height: pipBox,
          left: `${left}%`,
          marginLeft: -pipBox / 2,
          marginTop: -pipBox / 2,
          top: `${top}%`,
          width: pipBox,
        }]}
      >
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
    <View style={styles.hiddenRankRow}>
      {knowledge.rankPips.map((pipState, index) => {
        if (pipState.state === 'hidden') return null;
        const count = Math.max(1, knowledge.rankPips.length);
        const left = ((index + 0.5) / count) * 100;
        return <View key={`rank-${pipState.rank}`} style={[styles.hiddenRankPip, { left: `${left}%`, marginLeft: -rankBoxWidth / 2, width: rankBoxWidth }]}>
          <Text style={[styles.hiddenRankText, { fontSize: rankFontSize, lineHeight: rankFontSize + 1 }, pipState.positive && styles.positiveRankText]}>{pipState.rank}</Text>
          {pipState.state === 'eliminated' && <EliminationX size={Math.max(12, Math.round(16 * scale))} />}
        </View>;
      })}
    </View>
  </View>;
}

function CommittedClueMarker({ marker }: { marker: ClueCardMarker }) {
  return <View pointerEvents="none" style={[styles.clueMarker, marker.retouched && styles.clueMarkerRetouched]}>
    <Text style={[styles.clueArrow, marker.retouched && styles.clueArrowRetouched]}>↓</Text>
    <Text numberOfLines={1} style={[styles.clueMarkerText, marker.retouched && styles.clueMarkerTextRetouched]}>{marker.label}</Text>
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
  hiddenSuitPip: { alignItems: 'center', justifyContent: 'center', position: 'absolute' },
  hiddenRankRow: { bottom: '3%', height: '14%', left: '5%', position: 'absolute', right: '5%' },
  hiddenRankPip: { alignItems: 'center', height: 18, justifyContent: 'center', position: 'absolute', top: 0 },
  hiddenRankText: { color: '#f7f7f3', fontFamily: 'Arial', fontWeight: '900', textShadowColor: '#000000', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 1 },
  positiveRankText: { color: 'orange' },
  positiveSuitHalo: { backgroundColor: 'rgba(238, 188, 29, 0.22)', borderColor: 'rgba(13, 13, 13, 0.75)', borderWidth: 1, left: 0, position: 'absolute', top: 0 },
  eliminationStroke: { backgroundColor: '#111111', left: 0, position: 'absolute' },
  eliminationSlash: { transform: [{ rotate: '45deg' }] },
  eliminationBackslash: { transform: [{ rotate: '-45deg' }] },
  cardPosition: { bottom: 2, color: 'rgba(255,255,255,0.72)', fontSize: 7, fontWeight: '800', position: 'absolute', right: 3 },
  knowledgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, justifyContent: 'center' },
  legendPip: { alignItems: 'center', height: 24, justifyContent: 'center', position: 'relative', width: 24 },
  legendRank: { alignItems: 'center', height: 20, justifyContent: 'center', position: 'relative', width: 20 },
  rankPipText: { color: '#ffffff', fontSize: 13, fontWeight: '900', textShadowColor: '#000000', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 1 },
  visibleCard: { aspectRatio: 286 / 406, backgroundColor: 'transparent', borderRadius: 7, elevation: 2, justifyContent: 'center', overflow: 'hidden', shadowColor: '#000000', shadowOffset: { width: 2, height: 2 }, shadowOpacity: 0.26, shadowRadius: 2 },
  visibleHand: { height: 112 },
  visibleTable: { height: 86 },
  visibleMini: { borderRadius: 5, height: 56 },
  semanticInset: { ...StyleSheet.absoluteFill, borderRadius: 5, borderWidth: 3, zIndex: 3 },
  previewInset: { ...StyleSheet.absoluteFill, borderRadius: 5, borderWidth: 3, zIndex: 7 },
  clueMarker: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.94)', borderColor: '#111111', borderRadius: 7, borderWidth: 1, left: 3, minWidth: 20, paddingHorizontal: 3, paddingVertical: 1, position: 'absolute', top: 2, zIndex: 9 },
  clueMarkerRetouched: { backgroundColor: 'rgba(120,120,120,0.92)' },
  clueArrow: { color: '#111111', fontSize: 13, fontWeight: '900', lineHeight: 12 },
  clueArrowRetouched: { color: '#eeeeee' },
  clueMarkerText: { color: '#111111', fontSize: 8, fontWeight: '900', lineHeight: 9, maxWidth: 34 },
  clueMarkerTextRetouched: { color: '#f1f1f1' },
  noteIndicator: { alignItems: 'center', backgroundColor: '#d8d5ef', borderColor: '#0d0d0d', borderRadius: 3, borderWidth: 1, height: 16, justifyContent: 'center', position: 'absolute', right: 4, top: 4, transform: [{ rotate: '-8deg' }], width: 16, zIndex: 10 },
  noteIndicatorCompact: { height: 11, right: 2, top: 2, width: 11 },
  noteIndicatorText: { color: '#0d0d0d', fontSize: 11, fontWeight: '900', lineHeight: 12 },
  noteIndicatorTextCompact: { fontSize: 7, lineHeight: 8 },
  details: { gap: 5 },
  detailMuted: { fontSize: 11, fontStyle: 'italic' },
});
