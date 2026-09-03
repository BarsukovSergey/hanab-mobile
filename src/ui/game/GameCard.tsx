import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { CardKnowledgeViewModel } from '../../game/selectors/cardKnowledge';
import { getVariant } from '../../game/upstream/gameData';
import type { Suit } from '../../game/upstream/interfaces/Suit';
import { useHanabTheme } from '../designSystem';

type GameCardProps = {
  position: number;
  knowledge: CardKnowledgeViewModel;
  selected: boolean;
  onSelect: () => void;
  variantName: string;
};

export function GameCard({ position, knowledge, selected, onSelect, variantName }: GameCardProps) {
  const { theme } = useHanabTheme();
  const variant = getVariant(variantName);
  const determinedSuit = knowledge.suitDetermined && knowledge.possibleSuitLabels.length === 1
    ? variant.suits.find((suit) => suit.name === knowledge.possibleSuitLabels[0])
    : undefined;
  const determinedRank = knowledge.rankDetermined && knowledge.possibleRanks.length === 1
    ? knowledge.possibleRanks[0]
    : null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onSelect}
      style={({ pressed }) => [styles.cardTouch, pressed && { opacity: 0.82 }]}
    >
      <View style={[
        styles.card,
        { backgroundColor: '#888888', borderColor: selected ? theme.colors.accent : '#0d0d0d' },
        selected && styles.selectedCard,
      ]}>
        <View style={styles.corner}>
          <Text style={styles.cornerRank}>{determinedRank ?? '?'}</Text>
          <Text style={styles.cornerPip}>{determinedSuit === undefined ? '•' : pipGlyph(determinedSuit)}</Text>
        </View>
        <View style={styles.centerKnowledge}>
          <Text style={styles.position}>CARD {position + 1}</Text>
          {determinedSuit !== undefined && determinedRank !== null ? (
            <View style={[styles.identityBadge, { backgroundColor: safeSuitFill(determinedSuit) }]}> 
              <Text style={styles.identityPip}>{pipGlyph(determinedSuit)}</Text>
              <Text style={styles.identityRank}>{determinedRank}</Text>
            </View>
          ) : (
            <View style={styles.unknownBadge}><Text style={styles.unknownMark}>?</Text></View>
          )}
        </View>
        <View style={styles.knowledgeFooter}>
          <KnowledgePips knowledge={knowledge} variantName={variantName} />
        </View>
      </View>
      {selected && <Text style={[styles.selectedLabel, { color: theme.colors.accent }]}>SELECTED</Text>}
    </Pressable>
  );
}

export function VisibleHanabiCard({
  suitIndex, rank, variantName, position, selected = false, onPress,
}: {
  suitIndex: number | null;
  rank: number | null;
  variantName: string;
  position?: number;
  selected?: boolean;
  onPress?: () => void;
}) {
  const { theme } = useHanabTheme();
  const variant = getVariant(variantName);
  const suit = suitIndex === null ? undefined : variant.suits[suitIndex];
  const content = (
    <View style={[
      styles.visibleCard,
      { backgroundColor: suit === undefined ? '#777777' : safeSuitFill(suit) },
      selected && { borderColor: theme.colors.accent, borderWidth: 3 },
    ]}>
      <View style={styles.visibleCorner}>
        <Text style={styles.visibleRank}>{rank ?? '?'}</Text>
        <Text style={styles.visiblePip}>{suit === undefined ? '•' : pipGlyph(suit)}</Text>
      </View>
      <Text style={styles.visibleCenterPip}>{suit === undefined ? '?' : pipGlyph(suit)}</Text>
      <Text style={styles.visibleCenterRank}>{rank ?? '?'}</Text>
      {position !== undefined && <Text style={styles.visiblePosition}>{position + 1}</Text>}
    </View>
  );
  if (onPress === undefined) return content;
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress}>
      {content}
    </Pressable>
  );
}

export function CardKnowledgeDetails({ knowledge, variantName }: {
  knowledge: CardKnowledgeViewModel;
  variantName: string;
}) {
  const { theme } = useHanabTheme();
  return (
    <View style={styles.details}>
      {!knowledge.hasClueApplied && (
        <Text style={[styles.detailMuted, { color: theme.colors.textMuted }]}>No clue information</Text>
      )}
      <KnowledgePips knowledge={knowledge} variantName={variantName} />
    </View>
  );
}

function KnowledgePips({ knowledge, variantName }: { knowledge: CardKnowledgeViewModel; variantName: string }) {
  const variant = getVariant(variantName);
  const possibleSuits = variant.suits.filter((suit) => knowledge.possibleSuitLabels.includes(suit.name));
  return (
    <View style={styles.knowledgeRows}>
      <View style={styles.knowledgeRow}>
        {possibleSuits.map((suit) => {
          const positive = knowledge.positiveColorLabels.includes(suit.name);
          return (
            <View key={suit.name} style={[styles.suitPip, { backgroundColor: safeSuitFill(suit) }, positive && styles.positivePip]}>
              <Text style={styles.suitPipText}>{pipGlyph(suit)}</Text>
            </View>
          );
        })}
      </View>
      <View style={styles.knowledgeRow}>
        {knowledge.possibleRanks.map((rank) => {
          const positive = knowledge.positiveRanks.includes(rank);
          return (
            <View key={rank} style={[styles.rankPip, positive && styles.positiveRank]}>
              <Text style={styles.rankPipText}>{rank}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function safeSuitFill(suit: Suit): string {
  if (suit.fill === 'multi' || suit.fill === undefined || suit.fill.length === 0) return '#5d6570';
  return suit.fill;
}

function pipGlyph(suit: Suit): string {
  switch (suit.pip) {
    case 'hanabiRed1': return '●';
    case 'hanabiYellow2': return '◆';
    case 'hanabiGreen3': return '▲';
    case 'hanabiBlue4': return '■';
    case 'hanabiWhite5':
    case 'hanabiAltWhite6': return '★';
    case 'emptySet': return '∅';
    case 'hashtag': return '#';
    case 'infinity': return '∞';
    case 'moon': return '☾';
    case 'rainbow': return '◉';
    case 'triangle': return '△';
    case 'unoReverse': return '↺';
    case 'katakanaHe': return 'ヘ';
    case 'katakanaNu': return 'ヌ';
    default: return suit.abbreviation ?? suit.name.slice(0, 1).toUpperCase();
  }
}

const styles = StyleSheet.create({
  cardTouch: { alignItems: 'center', gap: 4 },
  card: { aspectRatio: 286 / 406, borderRadius: 9, borderWidth: 2, justifyContent: 'space-between', minWidth: 82, overflow: 'hidden', padding: 7, width: 92 },
  selectedCard: { borderWidth: 4, padding: 5 },
  corner: { alignItems: 'center', alignSelf: 'flex-start' },
  cornerRank: { color: '#ffffff', fontSize: 21, fontWeight: '900', lineHeight: 22, textShadowColor: '#000', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 1 },
  cornerPip: { color: '#ffffff', fontSize: 14, fontWeight: '900', lineHeight: 16, textShadowColor: '#000', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 1 },
  centerKnowledge: { alignItems: 'center', gap: 6 },
  position: { color: '#efefef', fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  unknownBadge: { alignItems: 'center', backgroundColor: '#696969', borderColor: '#bfbfbf', borderRadius: 30, borderWidth: 2, height: 48, justifyContent: 'center', width: 48 },
  unknownMark: { color: '#fff', fontSize: 28, fontWeight: '900' },
  identityBadge: { alignItems: 'center', borderColor: '#0d0d0d', borderRadius: 30, borderWidth: 2, height: 52, justifyContent: 'center', width: 52 },
  identityPip: { color: '#fff', fontSize: 18, fontWeight: '900', lineHeight: 18, textShadowColor: '#000', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 2 },
  identityRank: { color: '#fff', fontSize: 18, fontWeight: '900', lineHeight: 20, textShadowColor: '#000', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 2 },
  knowledgeFooter: { minHeight: 38 },
  knowledgeRows: { gap: 4 },
  knowledgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 3, justifyContent: 'center' },
  suitPip: { alignItems: 'center', borderColor: '#0d0d0d', borderRadius: 12, borderWidth: 1, height: 20, justifyContent: 'center', width: 20 },
  positivePip: { borderColor: '#ff9800', borderWidth: 3 },
  suitPipText: { color: '#fff', fontSize: 10, fontWeight: '900', textShadowColor: '#000', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 1 },
  rankPip: { alignItems: 'center', backgroundColor: '#f1f1f1', borderColor: '#0d0d0d', borderRadius: 11, borderWidth: 1, height: 20, justifyContent: 'center', width: 20 },
  positiveRank: { borderColor: '#ff9800', borderWidth: 3 },
  rankPipText: { color: '#0d0d0d', fontSize: 11, fontWeight: '900' },
  selectedLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 0.7 },
  visibleCard: { aspectRatio: 286 / 406, borderColor: '#0d0d0d', borderRadius: 8, borderWidth: 2, height: 112, justifyContent: 'center', overflow: 'hidden', padding: 6 },
  visibleCorner: { alignItems: 'center', left: 6, position: 'absolute', top: 5 },
  visibleRank: { color: '#fff', fontSize: 19, fontWeight: '900', lineHeight: 20, textShadowColor: '#000', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 2 },
  visiblePip: { color: '#fff', fontSize: 12, fontWeight: '900', textShadowColor: '#000', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 2 },
  visibleCenterPip: { alignSelf: 'center', color: '#fff', fontSize: 30, fontWeight: '900', lineHeight: 31, textShadowColor: '#000', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 2 },
  visibleCenterRank: { alignSelf: 'center', color: '#fff', fontSize: 28, fontWeight: '900', lineHeight: 29, textShadowColor: '#000', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 2 },
  visiblePosition: { bottom: 4, color: '#fff', fontSize: 9, fontWeight: '900', position: 'absolute', right: 6, textShadowColor: '#000', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 1 },
  details: { gap: 5 },
  detailMuted: { fontSize: 11, fontStyle: 'italic' },
});
