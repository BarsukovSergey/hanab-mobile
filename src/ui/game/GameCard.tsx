import { Button, StyleSheet, Text, View } from 'react-native';

import type { CardKnowledgeViewModel } from '../../game/selectors/cardKnowledge';

type GameCardProps = {
  position: number;
  knowledge: CardKnowledgeViewModel;
  controlsEnabled: boolean;
  onPlay: () => void;
  onDiscard: () => void;
};

export function GameCard({
  position,
  knowledge,
  controlsEnabled,
  onPlay,
  onDiscard,
}: GameCardProps) {
  const positiveClues = [
    ...knowledge.positiveColorLabels,
    ...knowledge.positiveRanks.map(String),
  ];

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Card {position + 1} · order {knowledge.order}</Text>
      {!knowledge.hasClueApplied && <Text>No clue information</Text>}
      {positiveClues.length > 0 && <Text>Clued: {positiveClues.join(' · ')}</Text>}
      <Text>Possible suits: {knowledge.possibleSuitLabels.join(' / ')}</Text>
      <Text>Possible ranks: {knowledge.possibleRanks.join(' / ')}</Text>
      <View style={styles.actions}>
        <Button disabled={!controlsEnabled} title="Play" onPress={onPlay} />
        <Button disabled={!controlsEnabled} title="Discard" onPress={onDiscard} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderColor: '#bbb', borderWidth: 1, gap: 4, padding: 8 },
  title: { fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 6 },
});
