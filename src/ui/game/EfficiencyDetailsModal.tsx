import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { GameplayPresentation } from '../../game/selectors/gameplay';
import { ActionButton, useHanabTheme } from '../designSystem';

export function EfficiencyDetailsModal({
  presentation,
  onClose,
  visible,
}: {
  presentation: GameplayPresentation;
  onClose: () => void;
  visible: boolean;
}) {
  const { theme } = useHanabTheme();
  const rows: ReadonlyArray<readonly [string, string]> = [
    ['Current cards gotten', String(presentation.rawCardsGotten)],
    ['Current cards noted as gotten', formatNumber(presentation.cardsGottenByNotes)],
    ['Current cards gotten modifier', formatNumber(presentation.efficiencyModifier)],
    ['Potential clues lost', String(presentation.potentialCluesLost)],
    ['Current efficiency', formatEfficiency(presentation.currentEfficiency)],
    ['Cards remaining to get', String(presentation.cardsRemainingToGet)],
    ['Remaining possible clues', formatNumber(presentation.remainingPossibleClues)],
    ['Future required efficiency', formatEfficiency(presentation.futureRequiredEfficiency)],
    ['Minimum required efficiency', presentation.minimumRequiredEfficiency.toFixed(2)],
    ['Finesses required', formatNumber(presentation.finessesRequired)],
  ];

  return <Modal animationType="fade" onRequestClose={onClose} statusBarTranslucent transparent visible={visible}>
    <View style={[styles.backdrop, { backgroundColor: theme.colors.overlay }]}>
      <View style={[styles.sheet, { backgroundColor: theme.colors.surfaceRaised, borderColor: theme.colors.borderStrong }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.colors.text }]}>Efficiency details</Text>
          <ActionButton compact title="Close" onPress={onClose} />
        </View>
        <ScrollView contentContainerStyle={styles.rows}>
          {rows.map(([label, value]) => <View key={label} style={styles.row}>
            <Text style={[styles.label, { color: theme.colors.textMuted }]}>{label}</Text>
            <Text style={[styles.value, { color: theme.colors.text }]}>{value}</Text>
          </View>)}
        </ScrollView>
      </View>
    </View>
  </Modal>;
}

function formatNumber(value: number | null): string {
  return value === null ? '-' : String(value);
}

function formatEfficiency(value: number | null): string {
  return value === null ? '-' : value.toFixed(2);
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center', padding: 18 },
  sheet: { borderRadius: 14, borderWidth: 1, gap: 10, maxHeight: '82%', padding: 14 },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  title: { fontSize: 17, fontWeight: '900' },
  rows: { gap: 8 },
  row: { alignItems: 'center', flexDirection: 'row', gap: 12, justifyContent: 'space-between' },
  label: { flex: 1, fontSize: 12, lineHeight: 17 },
  value: { fontSize: 13, fontVariant: ['tabular-nums'], fontWeight: '800' },
});
