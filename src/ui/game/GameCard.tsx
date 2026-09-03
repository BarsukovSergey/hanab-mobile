import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { CardKnowledgeViewModel } from '../../game/selectors/cardKnowledge';
import { getCardNoteVisual, getHandCardBorderColor } from '../../game/selectors/cardNoteVisuals';
import { getCardSuitVisuals, type CardSuitVisual } from '../../game/selectors/cardVisuals';
import { useAppSelector } from '../../store/hooks';
import { useHanabTheme } from '../designSystem';
import { UpstreamCardFace } from './UpstreamCardFace';
import { hasUpstreamSvgPip, UpstreamPip } from './UpstreamPip';

type GameCardProps = {
  position: number;
  knowledge: CardKnowledgeViewModel;
  selected: boolean;
  hasNote?: boolean;
  onSelect: () => void;
  onLongPress?: () => void;
  variantName: string;
};

type VisibleCardSize = 'hand' | 'table' | 'mini';

export function GameCard({ position, knowledge, selected, hasNote = false, onSelect, onLongPress, variantName }: GameCardProps) {
  const { theme } = useHanabTheme();
  const parsedNote = useAppSelector((state) => (
    state.room.room.kind === 'live_game'
      ? state.room.room.clientState.notes.ourNotes[knowledge.order]
      : undefined
  ));
  const noteVisual = getCardNoteVisual(parsedNote);
  const semanticBorder = getHandCardBorderColor(knowledge.hasClueApplied, noteVisual);

  return <Pressable
    accessibilityLabel={`Card ${position + 1}${hasNote ? ', has note' : ''}`}
    accessibilityRole="button"
    accessibilityState={{ selected }}
    delayLongPress={350}
    onLongPress={onLongPress}
    onPress={onSelect}
    style={({ pressed }) => [styles.cardTouch, pressed && styles.pressed]}
  >
    <View style={[
      styles.hiddenFrame,
      { borderColor: selected ? theme.colors.accent : '#0d0d0d' },
      selected && styles.selectedFrame,
    ]}>
      <View style={styles.hiddenCard}>
        {semanticBorder !== null && <View pointerEvents="none" style={[styles.semanticInset, { borderColor: semanticBorder }]} />}
        {hasNote && <NoteIndicator />}
        <HiddenKnowledgeOverlay knowledge={knowledge} variantName={variantName} />
        <Text style={styles.cardPosition}>{position + 1}</Text>
      </View>
    </View>
  </Pressable>;
}

export function VisibleHanabiCard({ suitIndex, rank, variantName, selected = false, hasNote = false, clued = false, onPress, onLongPress, size = 'hand' }: {
  suitIndex: number | null;
  rank: number | null;
  variantName: string;
  position?: number;
  selected?: boolean;
  hasNote?: boolean;
  clued?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  size?: VisibleCardSize;
}) {
  const { theme } = useHanabTheme();
  const suits = getCardSuitVisuals(variantName);
  const suit = suitIndex === null ? undefined : suits[suitIndex];
  const renderable = suit !== undefined && rank !== null && hasUpstreamSvgPip(suit.pip);
  const sizeStyles = size === 'mini' ? styles.visibleMini : size === 'table' ? styles.visibleTable : styles.visibleHand;

  const content = <View style={[
    styles.visibleCard,
    sizeStyles,
    {
      borderColor: selected ? theme.colors.accent : 'transparent',
      borderWidth: selected ? 5 : 0,
    },
  ]}>
    {renderable && suitIndex !== null
      ? <UpstreamCardFace rank={rank} suitIndex={suitIndex} variantName={variantName} />
      : <View style={styles.unsupportedFace}><Text style={styles.unsupportedFaceText}>?</Text></View>}
    {clued && <View pointerEvents="none" style={styles.cluedInset} />}
    {hasNote && <NoteIndicator compact={size === 'mini'} />}
  </View>;

  if (onPress === undefined && onLongPress === undefined) return content;
  return <Pressable
    accessibilityLabel={`${suit?.name ?? 'Unknown'} ${rank ?? 'unknown'}${hasNote ? ', has note' : ''}`}
    accessibilityRole="button"
    accessibilityState={{ selected }}
    delayLongPress={350}
    onLongPress={onLongPress}
    onPress={onPress}
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

function HiddenKnowledgeOverlay({ knowledge, variantName }: { knowledge: CardKnowledgeViewModel; variantName: string }) {
  const suits = getCardSuitVisuals(variantName);
  const suitCount = Math.max(knowledge.suitPips.length, 1);
  return <View pointerEvents="none" style={StyleSheet.absoluteFill}>
    {knowledge.suitPips.map((pipState) => {
      if (pipState.state === 'hidden') return null;
      const suit = suits[pipState.suitIndex];
      if (suit === undefined || !hasUpstreamSvgPip(suit.pip)) return null;
      const angle = (-pipState.suitIndex / suitCount + 0.25) * Math.PI * 2;
      const left = 50 - 28 * Math.cos(angle);
      const top = 50 - 19.7 * Math.sin(angle);
      return <View
        key={`suit-${pipState.suitIndex}`}
        style={[styles.hiddenSuitPip, { left: `${left}%`, top: `${top}%` }]}
      >
        {pipState.positive && <View style={styles.positiveSuitHalo} />}
        <UpstreamPip
          duplicatePip={suit.duplicatePip}
          fillColors={suit.fillColors}
          pip={suit.pip}
          size={25}
          suitName={suit.name}
        />
        {pipState.state === 'eliminated' && <EliminationX />}
      </View>;
    })}
    <View style={styles.hiddenRankRow}>
      {knowledge.rankPips.map((pipState, index) => {
        if (pipState.state === 'hidden') return null;
        const left = knowledge.rankPips.length === 5
          ? pipState.rank * 19 - 14
          : (index + 1) * 15 + 5;
        return <View key={`rank-${pipState.rank}`} style={[styles.hiddenRankPip, { left: `${left}%` }]}>
          <Text style={[styles.hiddenRankText, pipState.positive && styles.positiveRankText]}>{pipState.rank}</Text>
          {pipState.state === 'eliminated' && <EliminationX compact />}
        </View>;
      })}
    </View>
  </View>;
}

function EliminationX({ compact = false }: { compact?: boolean }) {
  return <View pointerEvents="none" style={[styles.eliminationX, compact && styles.eliminationXCompact]}>
    <View style={[styles.eliminationStroke, compact && styles.eliminationStrokeCompact, styles.eliminationSlash]} />
    <View style={[styles.eliminationStroke, compact && styles.eliminationStrokeCompact, styles.eliminationBackslash]} />
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
      {pipState.positive && <View style={styles.positiveSuitHalo} />}
      <SuitMarker suit={suit} compact />
      {pipState.state === 'eliminated' && <EliminationX compact />}
    </View>;
  })}</View>;
}

function KnowledgeRankLegend({ knowledge }: { knowledge: CardKnowledgeViewModel }) {
  return <View style={styles.knowledgeRow}>{knowledge.rankPips.filter((pipState) => pipState.state !== 'hidden').map((pipState) => (
    <View key={pipState.rank} style={styles.legendRank}>
      <Text style={[styles.rankPipText, pipState.positive && styles.positiveRankText]}>{pipState.rank}</Text>
      {pipState.state === 'eliminated' && <EliminationX compact />}
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
  hiddenFrame: { aspectRatio: 286 / 406, backgroundColor: '#0d0d0d', borderRadius: 9, borderWidth: 3, elevation: 3, shadowColor: '#000000', shadowOffset: { width: 3, height: 3 }, shadowOpacity: 0.35, shadowRadius: 3, width: 88 },
  selectedFrame: { borderWidth: 5 },
  hiddenCard: { backgroundColor: '#777777', borderRadius: 5, flex: 1, margin: 1, overflow: 'hidden' },
  hiddenSuitPip: { alignItems: 'center', height: 28, justifyContent: 'center', marginLeft: -14, marginTop: -14, position: 'absolute', width: 28 },
  hiddenRankRow: { bottom: '4%', height: '15%', left: 0, position: 'absolute', right: 0 },
  hiddenRankPip: { alignItems: 'center', height: 22, justifyContent: 'center', marginLeft: -7, position: 'absolute', top: 0, width: 14 },
  hiddenRankText: { color: '#ffffff', fontFamily: 'Arial', fontSize: 19, fontWeight: '900', lineHeight: 21, textShadowColor: '#000000', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 1 },
  positiveRankText: { color: 'orange' },
  positiveSuitHalo: { backgroundColor: 'rgba(238, 188, 29, 0.3)', borderColor: '#0d0d0d', borderRadius: 14, borderWidth: 1, height: 28, left: 0, position: 'absolute', top: 0, width: 28 },
  eliminationX: { height: 28, left: 0, position: 'absolute', top: 0, width: 28 },
  eliminationXCompact: { height: 18, left: '50%', marginLeft: -9, marginTop: -9, top: '50%', width: 18 },
  eliminationStroke: { backgroundColor: '#000000', height: 3, left: 1, position: 'absolute', top: 12, width: 26 },
  eliminationStrokeCompact: { height: 2, left: 1, top: 8, width: 16 },
  eliminationSlash: { transform: [{ rotate: '45deg' }] },
  eliminationBackslash: { transform: [{ rotate: '-45deg' }] },
  cardPosition: { bottom: 2, color: '#e8e8e8', fontSize: 8, fontWeight: '900', position: 'absolute', right: 4 },
  knowledgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, justifyContent: 'center' },
  legendPip: { alignItems: 'center', height: 28, justifyContent: 'center', position: 'relative', width: 28 },
  legendRank: { alignItems: 'center', height: 22, justifyContent: 'center', position: 'relative', width: 22 },
  rankPipText: { color: '#ffffff', fontSize: 14, fontWeight: '900', textShadowColor: '#000000', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 1 },
  visibleCard: { aspectRatio: 286 / 406, backgroundColor: 'transparent', borderRadius: 8, elevation: 3, justifyContent: 'center', overflow: 'hidden', shadowColor: '#000000', shadowOffset: { width: 3, height: 3 }, shadowOpacity: 0.32, shadowRadius: 3 },
  visibleHand: { height: 112 },
  visibleTable: { height: 86 },
  visibleMini: { borderRadius: 5, height: 56 },
  unsupportedFace: { alignItems: 'center', backgroundColor: '#777777', flex: 1, justifyContent: 'center', width: '100%' },
  unsupportedFaceText: { color: '#ffffff', fontSize: 28, fontWeight: '900' },
  semanticInset: { ...StyleSheet.absoluteFill, borderRadius: 5, borderWidth: 4, zIndex: 3 },
  cluedInset: { ...StyleSheet.absoluteFill, borderColor: 'orange', borderRadius: 5, borderWidth: 4, zIndex: 3 },
  noteIndicator: { alignItems: 'center', backgroundColor: '#d8d5ef', borderColor: '#0d0d0d', borderRadius: 3, borderWidth: 1, height: 18, justifyContent: 'center', position: 'absolute', right: 5, top: 5, transform: [{ rotate: '-8deg' }], width: 18, zIndex: 6 },
  noteIndicatorCompact: { height: 12, right: 3, top: 3, width: 12 },
  noteIndicatorText: { color: '#0d0d0d', fontSize: 13, fontWeight: '900', lineHeight: 14 },
  noteIndicatorTextCompact: { fontSize: 8, lineHeight: 9 },
  details: { gap: 5 },
  detailMuted: { fontSize: 11, fontStyle: 'italic' },
});
