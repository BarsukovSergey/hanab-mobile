import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { CardIdentity } from '../../game/bootstrap/types';
import type { HypotheticalMorphChoice } from '../../game/selectors/hypotheticalMorph';
import { VisibleHanabiCard } from './GameCard';
import { useHanabTheme } from '../designSystem';

export function HypotheticalMorphModal({
  visible, variantName, choices, current, onChoose, onUnmorph, onClose,
}: {
  visible: boolean;
  variantName: string;
  choices: readonly HypotheticalMorphChoice[];
  current: CardIdentity | undefined;
  onChoose: (identity: HypotheticalMorphChoice) => void;
  onUnmorph: () => void;
  onClose: () => void;
}) {
  const { theme } = useHanabTheme();
  return <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
    <View style={styles.backdrop}>
      <View accessibilityLabel="Hypothetical card morph picker" accessibilityRole="none" style={[styles.panel, { backgroundColor: theme.colors.surface, borderColor: theme.colors.borderStrong }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.colors.text }]}>Morph</Text>
          <Pressable accessibilityLabel="Close card identity picker" accessibilityRole="button" onPress={onClose} hitSlop={10}>
            <Text style={[styles.close, { color: theme.colors.text }]}>×</Text>
          </Pressable>
        </View>
        <View style={styles.actions}>
          <Pressable
            accessibilityLabel="Original card identity"
            accessibilityRole="button"
            accessibilityState={{ selected: current === undefined }}
            onPress={onUnmorph}
            style={[styles.original, { borderColor: current === undefined ? theme.colors.accent : theme.colors.border, borderWidth: 2 }]}
          >
            <Text style={{ color: theme.colors.text }}>Original</Text>
          </Pressable>
          <Text style={[styles.hint, { color: theme.colors.textMuted }]}>Select the card you want to morph it into.</Text>
        </View>
        <ScrollView contentContainerStyle={styles.grid}>
          {choices.map((identity) => {
            const selected = current?.suitIndex === identity.suitIndex && current.rank === identity.rank;
            return <Pressable
              accessibilityLabel={`Morph to suit ${identity.suitIndex + 1}, rank ${identity.rank}${selected ? ', selected' : ''}`}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              key={`${identity.suitIndex}:${identity.rank}`}
              onPress={() => onChoose(identity)}
              style={[styles.choice, { borderColor: selected ? theme.colors.accent : theme.colors.border }]}
            >
              <VisibleHanabiCard height={64} rank={identity.rank} selected={selected} size="mini" suitIndex={identity.suitIndex} variantName={variantName} />
            </Pressable>;
          })}
        </ScrollView>
      </View>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  backdrop: { alignItems: 'center', backgroundColor: '#0009', flex: 1, justifyContent: 'center', padding: 20 },
  panel: { borderRadius: 14, borderWidth: 1, maxHeight: '78%', maxWidth: 460, padding: 14, width: '100%' },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  title: { fontSize: 18, fontWeight: '700' },
  close: { fontSize: 28, lineHeight: 30 },
  actions: { alignItems: 'center', flexDirection: 'row', gap: 12, marginVertical: 10 },
  original: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 9 },
  hint: { flex: 1, fontSize: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, justifyContent: 'center', paddingVertical: 4 },
  choice: { alignItems: 'center', borderRadius: 8, borderWidth: 2, padding: 2 },
});
