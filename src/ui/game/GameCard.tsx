import { useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Path, Svg } from 'react-native-svg';

import type { CardKnowledgeViewModel } from '../../game/selectors/cardKnowledge';
import type { CardStatePresentation } from '../../game/selectors/cardStatePresentation';
import { getCardSuitVisuals, type CardSuitVisual } from '../../game/selectors/cardVisuals';
import { getClueColorFill } from '../../game/selectors/gameplay';
import { useHanabTheme } from '../designSystem';
import type { ClueCardMarker } from './clueIndication';
import { getWebRankPipLayout, getWebSuitPipLayout } from './knowledgeOverlayLayout';
import { UpstreamCardFace } from './UpstreamCardFace';
import { hasUpstreamSvgPip, UpstreamPip } from './UpstreamPip';
import { WebCardMarker } from './WebCardMarker';

type GameCardProps = {
  position: number;
  knowledge: CardKnowledgeViewModel;
  selected: boolean;
  clueMarker?: ClueCardMarker | null;
  previewMarker?: ClueCardMarker | null;
  cardTopHeadroom?: number;
  hasNote?: boolean;
  height?: number;
  statePresentation?: CardStatePresentation | null;
  onSelect: () => void;
  onLongPress?: () => void;
  onPressIn?: () => void;
  onPressOut?: () => void;
  variantName: string;
};

type VisibleCardSize = 'hand' | 'table' | 'mini';

export function GameCard({
  position,
  knowledge,
  selected,
  clueMarker = null,
  previewMarker = null,
  cardTopHeadroom = 0,
  hasNote = false,
  height,
  statePresentation = null,
  onSelect,
  onLongPress,
  onPressIn,
  onPressOut,
  variantName,
}: GameCardProps) {
  const { theme } = useHanabTheme();
  const longPressed = useRef(false);
  const compactIndicator = height !== undefined && height < 80;
  const renderedCardHeight = height ?? 88 / (286 / 406);
  const geometry = getCardGeometry(renderedCardHeight);

  return <Pressable
    accessibilityLabel={`Card ${position + 1}${hasNote ? ', has note' : ''}`}
    accessibilityRole="button"
    accessibilityState={{ selected }}
    delayLongPress={onLongPress === undefined ? undefined : 350}
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
    onPressIn={() => {
      longPressed.current = false;
      onPressIn?.();
    }}
    onTouchCancel={() => { longPressed.current = true; onPressOut?.(); }}
    onResponderTerminate={() => { longPressed.current = true; onPressOut?.(); }}
    onPressOut={onPressOut}
    style={({ pressed }) => [
      styles.cardTouch,
      height === undefined ? null : styles.sizedCardTouch,
      { transform: [
        ...(knowledge.borderColor === 'orange' ? [{ translateY: -cardTopHeadroom }] : []),
      ] },
      pressed && styles.pressed,
    ]}
  >
    <View style={[
      styles.cardShell,
      { borderRadius: geometry.radius, height: renderedCardHeight },
    ]}>
      <View style={[
        styles.cardSurface,
        { borderRadius: geometry.radius },
        statePresentation?.shouldFade && styles.engineTrashCard,
      ]}>
        <UpstreamCardFace rank={knowledge.displayRank} suitIndex={knowledge.displaySuitIndex} variantName={variantName} />
        {knowledge.borderColor !== null && <SemanticBorder color={knowledge.borderColor} radius={geometry.radius} height={renderedCardHeight} />}
        <HiddenKnowledgeOverlay height={height} knowledge={knowledge} variantName={variantName} />
        <CardStateIndicators
          clued={knowledge.borderColor === 'orange'}
          knownRank={knowledge.displayRank !== null}
          presentation={statePresentation}
        />
        {hasNote && <NoteIndicator compact={compactIndicator} />}
      </View>
      {previewMarker !== null && <CluePreviewHighlight height={renderedCardHeight} marker={previewMarker} />}
      {(previewMarker ?? clueMarker) !== null && <CluePointerMarker height={renderedCardHeight} marker={(previewMarker ?? clueMarker)!} variantName={variantName} />}
      {selected && <View pointerEvents="none" style={[styles.selectionHalo, { borderRadius: geometry.radius, borderColor: theme.colors.accent }]} />}
    </View>
  </Pressable>;
}

export function VisibleHanabiCard({
  suitIndex,
  rank,
  variantName,
  position,
  selected = false,
  clueMarker = null,
  previewMarker = null,
  cardTopHeadroom = 0,
  hasNote = false,
  semanticBorder = null,
  empathyKnowledge = null,
  statePresentation = null,
  faded = false,
  onPress,
  onLongPress,
  onPressIn,
  onPressOut,
  size = 'hand',
  height,
}: {
  suitIndex: number | null;
  rank: number | null;
  variantName: string;
  position?: number;
  selected?: boolean;
  clueMarker?: ClueCardMarker | null;
  previewMarker?: ClueCardMarker | null;
  cardTopHeadroom?: number;
  hasNote?: boolean;
  semanticBorder?: string | null;
  empathyKnowledge?: CardKnowledgeViewModel | null;
  statePresentation?: CardStatePresentation | null;
  faded?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  onPressIn?: () => void;
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
  const renderedCardHeight = height ?? (size === 'mini' ? 56 : size === 'table' ? 86 : 112);
  const geometry = getCardGeometry(renderedCardHeight);

  const content = <View style={[
    styles.cardShell,
    sizeStyles,
    height === undefined ? null : { height },
    { borderRadius: geometry.radius },
    activeSemanticBorder === 'orange' && { transform: [{ translateY: -cardTopHeadroom }] },
  ]}><View style={[
    styles.cardSurface,
    { borderRadius: geometry.radius },
    empathyActive && styles.empathyCard,
    (faded || statePresentation?.shouldFade) && styles.engineTrashCard,
  ]}>
    <UpstreamCardFace rank={faceRank} suitIndex={faceSuitIndex} variantName={variantName} />
    {activeSemanticBorder !== null && size === 'hand' && <SemanticBorder color={activeSemanticBorder} radius={geometry.radius} height={renderedCardHeight} />}
    {empathyActive && <HiddenKnowledgeOverlay height={height} knowledge={empathyKnowledge} variantName={variantName} />}
    <CardStateIndicators
      clued={activeSemanticBorder === 'orange'}
      knownRank={faceRank !== null}
      presentation={statePresentation}
    />
    {hasNote && <NoteIndicator compact={compactIndicator} />}
  </View>{previewMarker !== null && <CluePreviewHighlight height={renderedCardHeight} marker={previewMarker} />}
      {(previewMarker ?? clueMarker) !== null && <CluePointerMarker height={renderedCardHeight} marker={(previewMarker ?? clueMarker)!} variantName={variantName} />}{selected && <View pointerEvents="none" style={[styles.selectionHalo, { borderRadius: geometry.radius, borderColor: theme.colors.accent }]} />}</View>;

  if (
    onPress === undefined
    && onLongPress === undefined
    && onPressIn === undefined
    && onPressOut === undefined
  ) return content;
  return <Pressable
    accessibilityLabel={`${position === undefined ? '' : `Card ${position + 1}, `}${suit?.name ?? 'Unknown'} ${faceRank ?? 'unknown'}${hasNote ? ', has note' : ''}`}
    accessibilityRole="button"
    accessibilityState={{ selected }}
    delayLongPress={onLongPress === undefined ? undefined : 350}
    onLongPress={onLongPress === undefined ? undefined : () => {
      longPressed.current = true;
      onLongPress();
    }}
    onPress={() => {
      if (longPressed.current) {
        longPressed.current = false;
        return;
      }
      onPress?.();
    }}
    onPressIn={() => {
      longPressed.current = false;
      onPressIn?.();
    }}
    onTouchCancel={() => { longPressed.current = true; onPressOut?.(); }}
    onResponderTerminate={() => { longPressed.current = true; onPressOut?.(); }}
    onPressOut={onPressOut}
    style={({ pressed }) => pressed && styles.pressed}
  >{content}</Pressable>;
}

export function CompactHandCardSummary({
  suitIndex,
  rank,
  variantName,
  position,
  semanticBorder = null,
  empathyKnowledge = null,
  statePresentation = null,
  hasNote = false,
  clueMarker = null,
  previewMarker = null,
  onPress,
  onLongPress,
  onPressIn,
  onPressOut,
  height = 24,
}: {
  suitIndex: number | null;
  rank: number | null;
  variantName: string;
  position?: number;
  semanticBorder?: string | null;
  empathyKnowledge?: CardKnowledgeViewModel | null;
  statePresentation?: CardStatePresentation | null;
  hasNote?: boolean;
  clueMarker?: ClueCardMarker | null;
  previewMarker?: ClueCardMarker | null;
  onPress?: () => void;
  onLongPress?: () => void;
  onPressIn?: () => void;
  onPressOut?: () => void;
  height?: number;
}) {
  const { theme } = useHanabTheme();
  const longPressed = useRef(false);
  const empathyActive = empathyKnowledge !== null;
  const faceSuitIndex = empathyActive ? empathyKnowledge.displaySuitIndex : suitIndex;
  const faceRank = empathyActive ? empathyKnowledge.displayRank : rank;
  const suit = faceSuitIndex === null ? undefined : getCardSuitVisuals(variantName)[faceSuitIndex];
  const activeSemanticBorder = empathyActive ? empathyKnowledge.borderColor : semanticBorder;
  const primaryMarker = statePresentation?.critical ? 'critical'
    : statePresentation?.knownTrashNote ? 'trash'
      : statePresentation?.knownTrashFromEmpathy ? 'trash-mini'
        : statePresentation?.doubleDiscard ? 'dda' : null;
  const annotationMarker = statePresentation?.needsFix ? 'fix'
    : statePresentation?.exclamationMark ? 'exclamation'
      : statePresentation?.questionMark ? 'question' : null;

  return <Pressable
    accessibilityLabel={`${position === undefined ? 'Card' : `Card ${position + 1}`}, ${suit?.name ?? 'Unknown'} ${faceRank ?? 'unknown'}${hasNote ? ', has note' : ''}`}
    accessibilityRole="button"
    delayLongPress={onLongPress === undefined ? undefined : 350}
    onLongPress={onLongPress === undefined ? undefined : () => {
      longPressed.current = true;
      onLongPress();
    }}
    onPress={() => {
      if (longPressed.current) {
        longPressed.current = false;
        return;
      }
      onPress?.();
    }}
    onPressIn={() => {
      longPressed.current = false;
      onPressIn?.();
    }}
    onTouchCancel={() => { longPressed.current = true; onPressOut?.(); }}
    onResponderTerminate={() => { longPressed.current = true; onPressOut?.(); }}
    onPressOut={onPressOut}
    style={({ pressed }) => [styles.compactSummaryTouch, pressed && styles.pressed]}
  >
    <View style={[
      styles.compactSummary,
      { backgroundColor: theme.colors.surfaceRaised, borderColor: activeSemanticBorder ?? theme.colors.border, height },
      activeSemanticBorder !== null && styles.compactSummarySemanticBorder,
      statePresentation?.shouldFade && styles.engineTrashCard,
    ]}>
      <View style={styles.compactIdentity}>
        {suit === undefined || !hasUpstreamSvgPip(suit.pip) ? <Text style={[styles.compactUnknown, { color: theme.colors.text }]}>?</Text> : <UpstreamPip
          duplicatePip={suit.duplicatePip}
          fillColors={suit.fillColors}
          pip={suit.pip}
          size={11}
          suitName={suit.name}
        />}
        <Text style={[styles.compactRank, { color: theme.colors.text }]}>{faceRank ?? '?'}</Text>
      </View>
      {primaryMarker !== null && <View pointerEvents="none" style={styles.compactPrimaryMarker}><WebCardMarker kind={primaryMarker} /></View>}
      {annotationMarker !== null && <View pointerEvents="none" style={styles.compactAnnotationMarker}><WebCardMarker kind={annotationMarker} /></View>}
      {hasNote && <View pointerEvents="none" style={styles.compactNoteMarker}><WebCardMarker kind="note" /></View>}
      {previewMarker !== null && <CluePreviewHighlight height={height} marker={previewMarker} />}
      {(previewMarker ?? clueMarker) !== null && <CluePointerMarker height={height} marker={(previewMarker ?? clueMarker)!} variantName={variantName} />}
    </View>
  </Pressable>;
}

export function CardKnowledgeDetails({ knowledge, variantName }: { knowledge: CardKnowledgeViewModel; variantName: string }) {
  const hasVisibleKnowledge = knowledge.suitPips.some((pipState) => pipState.state !== 'hidden')
    || knowledge.rankPips.some((pipState) => pipState.state !== 'hidden');
  if (!hasVisibleKnowledge) return null;
  return <View style={styles.details}>
    <KnowledgeSuitLegend knowledge={knowledge} variantName={variantName} />
    <KnowledgeRankLegend knowledge={knowledge} />
  </View>;
}

function SemanticBorder({ color, radius, height }: { color: string; radius: number; height: number }) {
  const scale = height / 406;
  const outsideWidth = 20 * scale;
  const insideWidth = 12 * scale;

  return <View pointerEvents="none" style={styles.semanticBorderLayer}>
    <View style={[styles.semanticBorderStroke, { borderColor: '#0d0d0d', borderRadius: radius, borderWidth: outsideWidth }]} />
    <View style={[styles.semanticBorderStroke, { borderColor: color, borderRadius: radius, borderWidth: insideWidth }]} />
  </View>;
}

function HiddenKnowledgeOverlay({ knowledge, variantName, height }: { knowledge: CardKnowledgeViewModel; variantName: string; height?: number }) {
  const suits = getCardSuitVisuals(variantName);
  const visibleSuits = knowledge.displaySuitIndex === null
    ? knowledge.suitPips.filter((pipState) => pipState.state !== 'hidden')
    : [];
  const visibleRanks = knowledge.displayRank === null
    ? knowledge.rankPips.filter((pipState) => pipState.state !== 'hidden')
    : [];

  return <View pointerEvents="none" style={styles.knowledgeOverlay}>
    {visibleSuits.map((pipState) => {
      const suit = suits[pipState.suitIndex];
      if (suit === undefined || !hasUpstreamSvgPip(suit.pip)) return null;
      const layout = getWebSuitPipLayout(height, pipState.suitIndex, suits.length);
      return <View
        key={`suit-${pipState.suitIndex}`}
        style={[styles.knowledgeToken, { height: layout.size, left: layout.left, top: layout.top, width: layout.size }]}
      >
        {pipState.positive && <View style={[styles.positiveSuitHalo, { borderRadius: layout.size / 2, height: layout.size, width: layout.size }]} />}
        <UpstreamPip
          duplicatePip={suit.duplicatePip}
          fillColors={suit.fillColors}
          pip={suit.pip}
          size={layout.size}
          suitName={suit.name}
        />
        {pipState.state === 'eliminated' && <EliminationX size={layout.size} />}
      </View>;
    })}
    {visibleRanks.map((pipState) => {
      const layout = getWebRankPipLayout(height, pipState.rank, knowledge.rankPips.length);
      return <View
        key={`rank-${pipState.rank}`}
        style={[styles.rankToken, { height: layout.boxSize, left: layout.left, top: layout.top, width: layout.boxSize }]}
      >
        <Text style={[
          styles.hiddenRankText,
          { fontSize: layout.fontSize, lineHeight: layout.fontSize + 1 },
          pipState.positive && styles.positiveRankText,
        ]}>{pipState.rank}</Text>
        {pipState.state === 'eliminated' && <EliminationX size={layout.boxSize} />}
      </View>;
    })}
  </View>;
}

/** Candidate channel: dashed double-contrast outline and an in-face plus, not a committed clue. */
function CluePreviewHighlight({ height, marker }: { height: number; marker: ClueCardMarker }) {
  const size = Math.max(18, Math.min(24, Math.round(height * 0.28)));
  return <View pointerEvents="none" testID="clue-preview-highlight" accessibilityLabel={`Clue preview touches this card, ${marker.kind} ${marker.label}`}
    style={[StyleSheet.absoluteFill, { borderColor: '#000000', borderWidth: 4, borderRadius: getCardGeometry(height).radius }]}>
    <View style={[StyleSheet.absoluteFill, { borderColor: '#ffffff', borderWidth: 2, borderStyle: 'dashed', borderRadius: getCardGeometry(height).radius }]} />
    <View testID="clue-preview-badge" style={{ position: 'absolute', right: 1, top: '50%', marginTop: -size / 2, width: size, height: size,
      alignItems: 'center', justifyContent: 'center', backgroundColor: '#111111', borderColor: '#ffffff', borderWidth: 2, borderRadius: 4 }}>
      <Text allowFontScaling={false} style={{ color: '#ffffff', fontSize: Math.max(12, size - 8), fontWeight: '900', lineHeight: size - 4 }}>+</Text>
    </View>
  </View>;
}

function CluePointerMarker({ height, marker, variantName }: { height?: number; marker: ClueCardMarker; variantName: string }) {
  const arrowColor = marker.retouched ? '#737373' : '#ffffff';
  const cardHeight = height ?? 112;
  const circleDiameter = clamp(Math.round(cardHeight * 0.12), 8, 11);
  const arrowTail = clamp(Math.round(cardHeight * 0.07), 4, 7);
  const pointerHeight = circleDiameter + arrowTail;
  const headBaseY = circleDiameter - 1;
  const tipY = pointerHeight - 1;
  const rankFontSize = Math.round(circleDiameter * 0.55);
  const clueFill = marker.kind === 'color'
    ? getClueColorFill(variantName, marker.value) ?? '#ffffff'
    : '#111111';
  const center = circleDiameter / 2;
  return <View pointerEvents="none" style={[styles.clueMarker, { height: pointerHeight, marginLeft: -center, width: circleDiameter }]}>
    <Svg height={pointerHeight} style={styles.clueArrow} viewBox={`0 0 ${circleDiameter} ${pointerHeight}`} width={circleDiameter}>
      <Path d={`M ${center - 3} 1 H ${center + 3} V ${headBaseY} L ${center} ${tipY} L ${center - 3} ${headBaseY} Z`} fill="#111111" />
      <Path d={`M ${center - 1.5} 2 H ${center + 1.5} V ${headBaseY + 1} L ${center} ${tipY - 2} L ${center - 1.5} ${headBaseY + 1} Z`} fill={arrowColor} />
    </Svg>
    <View style={[
      styles.clueCircle,
      { backgroundColor: clueFill, borderRadius: circleDiameter / 2, height: circleDiameter, width: circleDiameter }, styles.clueBadge,
      marker.kind === 'rank' && styles.rankClueCircle,
    ]}>
      {marker.kind === 'rank' && <Text numberOfLines={1} style={[styles.rankClueText, { fontSize: rankFontSize, lineHeight: rankFontSize }]}>{marker.label}</Text>}
    </View>
  </View>;
}

export function getCardGeometry(height: number) {
  return { radius: height * 286 / 406 * 0.12 };
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
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

function CardStateIndicators({ presentation, knownRank, clued }: {
  presentation: CardStatePresentation | null;
  knownRank: boolean;
  clued: boolean;
}) {
  if (presentation === null) return null;

  const showDoubleDiscard = presentation.doubleDiscard && !clued && !presentation.knownTrashNote;
  const showEmpathyTrash = presentation.knownTrashFromEmpathy && !presentation.knownTrashNote;
  const cornerStyle = knownRank ? styles.webMarkerSmallBottom : styles.webMarkerSmallTop;

  return <View pointerEvents="none" style={styles.webMarkerLayer}>
    {presentation.knownTrashNote && <View style={styles.webMarkerTrash}>
      <WebCardMarker kind="trash" />
    </View>}
    {presentation.questionMark && <View style={styles.webMarkerQuestion}>
      <WebCardMarker kind="question" />
    </View>}
    {presentation.exclamationMark && <View style={styles.webMarkerQuestion}>
      <WebCardMarker kind="exclamation" />
    </View>}
    {presentation.needsFix && <View style={styles.webMarkerFix}>
      <WebCardMarker kind="fix" />
    </View>}
    {presentation.critical && <View style={styles.webMarkerCritical}>
      <WebCardMarker kind="critical" />
    </View>}
    {showEmpathyTrash && <View style={cornerStyle}>
      <WebCardMarker kind="trash-mini" />
    </View>}
    {showDoubleDiscard && <View style={cornerStyle}>
      <WebCardMarker kind="dda" />
    </View>}
  </View>;
}

function NoteIndicator({ compact = false }: { compact?: boolean }) {
  return <View pointerEvents="none" style={[styles.noteIndicator, compact && styles.noteIndicatorCompact]}>
    <WebCardMarker kind="note" />
  </View>;
}

const styles = StyleSheet.create({
  cardTouch: { alignItems: 'center' },
  sizedCardTouch: { marginRight: -1 },
  pressed: { opacity: 0.82 },
  cardShell: { aspectRatio: 286 / 406, elevation: 2, position: 'relative', shadowColor: '#000000', shadowOffset: { width: 2, height: 2 }, shadowOpacity: 0.26, shadowRadius: 2 },
  cardSurface: { backgroundColor: '#747a76', flex: 1, overflow: 'hidden' },
  selectionHalo: { borderWidth: 2, bottom: -3, left: -3, position: 'absolute', right: -3, top: -3, zIndex: 12 },
  empathyCard: { backgroundColor: '#747a76' },
  engineTrashCard: { opacity: 0.6 },
  semanticBorderLayer: { bottom: 0, left: 0, position: 'absolute', right: 0, top: 0, zIndex: 3 },
  semanticBorderStroke: { bottom: 0, left: 0, position: 'absolute', right: 0, top: 0 },
  knowledgeOverlay: { bottom: 0, left: 0, position: 'absolute', right: 0, top: 0 },
  knowledgeToken: { alignItems: 'center', justifyContent: 'center', position: 'absolute' },
  rankToken: { alignItems: 'center', justifyContent: 'center', position: 'absolute' },
  hiddenRankText: { color: '#f7f7f3', fontFamily: 'Arial', fontWeight: '900', textShadowColor: '#000000', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 1 },
  positiveRankText: { color: 'orange' },
  positiveSuitHalo: { backgroundColor: 'rgba(238, 188, 29, 0.30)', borderColor: 'rgba(13, 13, 13, 0.70)', borderWidth: 1, left: 0, position: 'absolute', top: 0 },
  eliminationStroke: { backgroundColor: '#111111', left: 0, position: 'absolute' },
  eliminationSlash: { transform: [{ rotate: '45deg' }] },
  eliminationBackslash: { transform: [{ rotate: '-45deg' }] },
  knowledgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, justifyContent: 'center' },
  legendPip: { alignItems: 'center', height: 24, justifyContent: 'center', position: 'relative', width: 24 },
  legendRank: { alignItems: 'center', height: 20, justifyContent: 'center', position: 'relative', width: 20 },
  rankPipText: { color: '#ffffff', fontSize: 13, fontWeight: '900', textShadowColor: '#000000', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 1 },
  visibleCard: { justifyContent: 'center' },
  visibleHand: { height: 112 },
  visibleTable: { height: 86 },
  visibleMini: { height: 56 },
  compactSummaryTouch: { flex: 1, minWidth: 0 },
  compactSummary: { alignItems: 'center', borderRadius: 6, borderWidth: 1, justifyContent: 'center', minWidth: 0, overflow: 'visible', position: 'relative' },
  compactSummarySemanticBorder: { borderWidth: 2 },
  compactIdentity: { alignItems: 'center', flexDirection: 'row', gap: 2, justifyContent: 'center' },
  compactRank: { fontSize: 12, fontWeight: '900', lineHeight: 13 },
  compactUnknown: { fontSize: 12, fontWeight: '900', lineHeight: 13 },
  compactPrimaryMarker: { bottom: 1, height: 8, left: 1, position: 'absolute', width: 8, zIndex: 10 },
  compactAnnotationMarker: { bottom: 1, height: 8, position: 'absolute', right: 1, width: 8, zIndex: 10 },
  compactNoteMarker: { height: 8, position: 'absolute', right: 1, top: 1, width: 8, zIndex: 10 },
  clueMarker: { alignItems: 'center', left: '50%', position: 'absolute', top: -3, zIndex: 9 },
  clueArrow: { left: 0, position: 'absolute', top: 0 },
  clueBadge: { position: 'absolute', top: 0 },
  clueCircle: { alignItems: 'center', borderColor: '#111111', borderWidth: 1, justifyContent: 'center' },
  rankClueCircle: { backgroundColor: '#111111', borderColor: '#ffffff' },
  rankClueText: { color: '#ffffff', fontWeight: '900', maxWidth: 11 },
  webMarkerLayer: { bottom: 0, left: 0, position: 'absolute', right: 0, top: 0, zIndex: 10 },
  webMarkerTrash: { height: '60%', left: '15%', position: 'absolute', top: '20%', width: '70%' },
  webMarkerQuestion: { aspectRatio: 1, left: '15%', position: 'absolute', top: '20%', width: '80%' },
  webMarkerFix: { aspectRatio: 1, left: '10%', position: 'absolute', top: '33%', width: '80%' },
  webMarkerCritical: { aspectRatio: 1, bottom: '4%', left: '6%', position: 'absolute', width: '20%' },
  webMarkerSmallTop: { aspectRatio: 1, left: '5%', position: 'absolute', top: '5%', width: '20%' },
  webMarkerSmallBottom: { aspectRatio: 1, bottom: '4%', left: '6%', position: 'absolute', width: '20%' },
  noteIndicator: { aspectRatio: 1, position: 'absolute', right: '2%', top: '3%', width: '20%', zIndex: 10 },
  noteIndicatorCompact: { right: '2%', top: '3%', width: '21%' },
  details: { gap: 5 },
});
