import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { CardKnowledgeViewModel } from '../../game/selectors/cardKnowledge';

type GameCardProps = {
  position: number;
  knowledge: CardKnowledgeViewModel;
  selected: boolean;
  onSelect: () => void;
};

export function GameCard({ position, knowledge, selected, onSelect }: GameCardProps) {
  const positiveClues = [
    ...knowledge.positiveColorLabels,
    ...knowledge.positiveRanks.map(String),
  ];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onSelect}
      style={[styles.card, selected && styles.selectedCard]}
    >
      <View style={styles.titleRow}>
        <Text style={styles.title}>Card {position + 1}</Text>
        {selected && <Text style={styles.selectedLabel}>SELECTED</Text>}
      </View>
      {!knowledge.hasClueApplied && <Text style={styles.muted}>No clue information</Text>}
      {positiveClues.length > 0 && <Text>Clued: {positiveClues.join(' · ')}</Text>}
      <Text>Possible colors: {knowledge.possibleSuitLabels.join(' / ')}</Text>
      <Text>Possible ranks: {knowledge.possibleRanks.join(' / ')}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderColor: '#c7ccd1',
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
    padding: 12,
  },
  selectedCard: { borderColor: '#2457a6', borderWidth: 2, padding: 11 },
  titleRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  title: { fontWeight: '600' },
  selectedLabel: { color: '#2457a6', fontSize: 12, fontWeight: '700' },
  muted: { color: '#626b73' },
});
