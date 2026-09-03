import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { CardKnowledgeViewModel } from '../../game/selectors/cardKnowledge';
import { getCardSuitVisuals } from '../../game/selectors/cardVisuals';
import { useHanabTheme } from '../designSystem';

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
  const suits = getCardSuitVisuals(variantName);
  const determinedSuit = knowledge.suitDetermined && knowledge.possibleSuitLabels.length === 1
    ? suits.find((suit) => suit.name === knowledge.possibleSuitLabels[0])
    : undefined;
  const determinedRank = knowledge.rankDetermined && knowledge.possibleRanks.length === 1 ? knowledge.possibleRanks[0] : null;

  return <Pressable accessibilityLabel={`Card ${position + 1}${hasNote ? ', has note' : ''}`} accessibilityRole="button"
    accessibilityState={{ selected }} delayLongPress={350} onLongPress={onLongPress} onPress={onSelect}
    style={({ pressed }) => [styles.cardTouch, pressed && styles.pressed]}>
    <View style={[styles.hiddenFrame, { borderColor: selected ? theme.colors.accent : '#0d0d0d' }, selected && styles.selectedFrame]}>
      <View style={styles.hiddenCard}>
        <View style={styles.hiddenCorner}>
          <Text style={styles.hiddenCornerRank}>{determinedRank ?? ''}</Text>
          <Text style={styles.hiddenCornerPip}>{determinedSuit?.marker ?? ''}</Text>
        </View>
        {hasNote && <NoteIndicator />}
        <View style={styles.hiddenCenter}><KnowledgeSuitPips knowledge={knowledge} variantName={variantName} /></View>
        <View style={styles.hiddenBottom}><KnowledgeRankPips knowledge={knowledge} /></View>
        <Text style={styles.cardPosition}>{position + 1}</Text>
      </View>
    </View>
  </Pressable>;
}

export function VisibleHanabiCard({ suitIndex, rank, variantName, position, selected = false, hasNote = false, onPress, onLongPress, size = 'hand' }: {
  suitIndex: number | null;
  rank: number | null;
  variantName: string;
  position?: number;
  selected?: boolean;
  hasNote?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  size?: VisibleCardSize;
}) {
  const { theme } = useHanabTheme();
  const suits = getCardSuitVisuals(variantName);
  const suit = suitIndex === null ? undefined : suits[suitIndex];
  const foreground = suit?.foreground ?? '#ffffff';
  const shadow = foreground === '#0d0d0d' ? '#ffffff' : '#000000';
  const sizeStyles = size === 'mini' ? styles.visibleMini : size === 'table' ? styles.visibleTable : styles.visibleHand;
  const rankStyle = size === 'mini' ? styles.miniRank : size === 'table' ? styles.tableRank : styles.handRank;
  const pipStyle = size === 'mini' ? styles.miniPip : size === 'table' ? styles.tablePip : styles.handPip;
  const cornerRankStyle = size === 'mini' ? styles.miniCornerRank : size === 'table' ? styles.tableCornerRank : styles.handCornerRank;
  const cornerPipStyle = size === 'mini' ? styles.miniCornerPip : size === 'table' ? styles.tableCornerPip : styles.handCornerPip;
  const textShadow = { textShadowColor: shadow, textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 1 } as const;
  const content = <View style={[styles.visibleCard, sizeStyles, { backgroundColor: suit?.fill ?? '#777777' }, selected && { borderColor: theme.colors.accent, borderWidth: 4 }]}>
    <View style={styles.visibleCorner}>
      <Text style={[cornerRankStyle, { color: foreground }, textShadow]}>{rank ?? '?'}</Text>
      <Text style={[cornerPipStyle, { color: foreground }, textShadow]}>{suit?.marker ?? '•'}</Text>
    </View>
    {hasNote && <NoteIndicator compact={size === 'mini'} />}
    <View style={styles.visibleCenter}>
      <Text style={[pipStyle, { color: foreground }, textShadow]}>{suit?.marker ?? '?'}</Text>
      <Text style={[rankStyle, { color: foreground }, textShadow]}>{rank ?? '?'}</Text>
    </View>
    {position !== undefined && size === 'hand' && <Text style={[styles.visiblePosition, { color: foreground }, textShadow]}>{position + 1}</Text>}
  </View>;
  if (onPress === undefined && onLongPress === undefined) return content;
  return <Pressable accessibilityLabel={`${suit?.name ?? 'Unknown'} ${rank ?? 'unknown'}${hasNote ? ', has note' : ''}`}
    accessibilityRole="button" accessibilityState={{ selected }} delayLongPress={350} onLongPress={onLongPress} onPress={onPress}
    style={({ pressed }) => pressed && styles.pressed}>{content}</Pressable>;
}

export function CardKnowledgeDetails({ knowledge, variantName }: { knowledge: CardKnowledgeViewModel; variantName: string }) {
  const { theme } = useHanabTheme();
  return <View style={styles.details}>
    {!knowledge.hasClueApplied && <Text style={[styles.detailMuted, { color: theme.colors.textMuted }]}>No clue information</Text>}
    <KnowledgeSuitPips knowledge={knowledge} variantName={variantName} />
    <KnowledgeRankPips knowledge={knowledge} />
  </View>;
}

function KnowledgeSuitPips({ knowledge, variantName }: { knowledge: CardKnowledgeViewModel; variantName: string }) {
  const suits = getCardSuitVisuals(variantName);
  const possibleSuits = suits.filter((suit) => knowledge.possibleSuitLabels.includes(suit.name));
  return <View style={styles.knowledgeRow}>{possibleSuits.map((suit) => {
    const positive = knowledge.positiveColorLabels.includes(suit.name);
    return <View key={suit.name} style={[styles.suitPip, { backgroundColor: suit.fill }, positive && styles.positivePip]}>
      <Text style={[styles.suitPipText, { color: suit.foreground }]}>{suit.marker}</Text>
    </View>;
  })}</View>;
}

function KnowledgeRankPips({ knowledge }: { knowledge: CardKnowledgeViewModel }) {
  return <View style={styles.knowledgeRow}>{knowledge.possibleRanks.map((rank) => {
    const positive = knowledge.positiveRanks.includes(rank);
    return <View key={rank} style={[styles.rankPip, positive && styles.positiveRank]}><Text style={styles.rankPipText}>{rank}</Text></View>;
  })}</View>;
}

function NoteIndicator({ compact = false }: { compact?: boolean }) {
  return <View style={[styles.noteIndicator, compact && styles.noteIndicatorCompact]}>
    <Text style={[styles.noteIndicatorText, compact && styles.noteIndicatorTextCompact]}>✎</Text>
  </View>;
}

const styles = StyleSheet.create({
  cardTouch: { alignItems: 'center' }, pressed: { opacity: 0.82 },
  hiddenFrame: { aspectRatio: 286 / 406, backgroundColor: '#0d0d0d', borderRadius: 9, borderWidth: 3, elevation: 3, shadowColor: '#000000', shadowOffset: { width: 3, height: 3 }, shadowOpacity: 0.35, shadowRadius: 3, width: 88 },
  selectedFrame: { borderWidth: 5 }, hiddenCard: { backgroundColor: '#888888', borderRadius: 5, flex: 1, margin: 1, overflow: 'hidden' },
  hiddenCorner: { alignItems: 'center', left: 5, minWidth: 20, position: 'absolute', top: 5, zIndex: 2 },
  hiddenCornerRank: { color: '#ffffff', fontSize: 19, fontWeight: '900', lineHeight: 20, textShadowColor: '#000000', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 1 },
  hiddenCornerPip: { color: '#ffffff', fontSize: 12, fontWeight: '900', lineHeight: 14, textShadowColor: '#000000', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 1 },
  hiddenCenter: { alignItems: 'center', flex: 1, justifyContent: 'center', paddingHorizontal: 5 }, hiddenBottom: { alignItems: 'center', minHeight: 30, paddingBottom: 7, paddingHorizontal: 4 },
  cardPosition: { bottom: 4, color: '#e8e8e8', fontSize: 9, fontWeight: '900', position: 'absolute', right: 5 },
  knowledgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 3, justifyContent: 'center' },
  suitPip: { alignItems: 'center', borderColor: '#0d0d0d', borderRadius: 12, borderWidth: 1, height: 21, justifyContent: 'center', width: 21 }, positivePip: { borderColor: 'orange', borderWidth: 3 }, suitPipText: { fontSize: 10, fontWeight: '900' },
  rankPip: { alignItems: 'center', backgroundColor: '#d8d5ef', borderColor: '#0d0d0d', borderRadius: 11, borderWidth: 1, height: 20, justifyContent: 'center', width: 20 }, positiveRank: { borderColor: 'orange', borderWidth: 3 }, rankPipText: { color: '#0d0d0d', fontSize: 11, fontWeight: '900' },
  visibleCard: { aspectRatio: 286 / 406, borderColor: '#0d0d0d', borderRadius: 8, borderWidth: 3, elevation: 3, justifyContent: 'center', overflow: 'hidden', shadowColor: '#000000', shadowOffset: { width: 3, height: 3 }, shadowOpacity: 0.32, shadowRadius: 3 },
  visibleHand: { height: 108 }, visibleTable: { height: 84 }, visibleMini: { borderRadius: 5, borderWidth: 2, height: 54 },
  visibleCorner: { alignItems: 'center', left: 5, position: 'absolute', top: 4 }, handCornerRank: { fontSize: 19, fontWeight: '900', lineHeight: 20 }, handCornerPip: { fontSize: 12, fontWeight: '900', lineHeight: 14 }, tableCornerRank: { fontSize: 15, fontWeight: '900', lineHeight: 16 }, tableCornerPip: { fontSize: 10, fontWeight: '900', lineHeight: 11 }, miniCornerRank: { fontSize: 10, fontWeight: '900', lineHeight: 10 }, miniCornerPip: { fontSize: 7, fontWeight: '900', lineHeight: 8 },
  visibleCenter: { alignItems: 'center', justifyContent: 'center' }, handPip: { fontSize: 28, fontWeight: '900', lineHeight: 29 }, handRank: { fontSize: 29, fontWeight: '900', lineHeight: 30 }, tablePip: { fontSize: 21, fontWeight: '900', lineHeight: 22 }, tableRank: { fontSize: 23, fontWeight: '900', lineHeight: 24 }, miniPip: { fontSize: 13, fontWeight: '900', lineHeight: 13 }, miniRank: { fontSize: 14, fontWeight: '900', lineHeight: 15 },
  visiblePosition: { bottom: 4, fontSize: 9, fontWeight: '900', position: 'absolute', right: 5 },
  noteIndicator: { alignItems: 'center', backgroundColor: '#d8d5ef', borderColor: '#0d0d0d', borderRadius: 3, borderWidth: 1, height: 18, justifyContent: 'center', position: 'absolute', right: 5, top: 5, transform: [{ rotate: '-8deg' }], width: 18, zIndex: 4 }, noteIndicatorCompact: { height: 12, right: 3, top: 3, width: 12 }, noteIndicatorText: { color: '#0d0d0d', fontSize: 13, fontWeight: '900', lineHeight: 14 }, noteIndicatorTextCompact: { fontSize: 8, lineHeight: 9 },
  details: { gap: 5 }, detailMuted: { fontSize: 11, fontStyle: 'italic' },
});
