import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { GameplayPresentation } from '../../game/selectors/gameplay';
import { ActionButton, useHanabTheme } from '../designSystem';

type PaceRisk = GameplayPresentation['paceRisk'];

export function getPaceRiskColor(risk: PaceRisk, defaultColor: string): string {
  if (risk === 'medium') return '#efef1d';
  if (risk === 'high') return '#ef8c1d';
  if (risk === 'zero') return '#df1c2d';
  return defaultColor;
}

export function PaceDetailsModal({
  onClose,
  pace,
  paceRisk,
  visible,
}: {
  onClose: () => void;
  pace: string;
  paceRisk: PaceRisk;
  visible: boolean;
}) {
  const { theme } = useHanabTheme();
  const risk = paceRisk === null ? 'Unavailable' : paceRisk[0]!.toUpperCase() + paceRisk.slice(1);
  const explanations: ReadonlyArray<readonly [string, string]> = [
    ['Low', 'Default text color; the default early or mid-game state.'],
    ['Medium', 'Yellow (#efef1d); a conservative end-game risk estimate.'],
    ['High', 'Orange (#ef8c1d); a strategic end-game risk estimate that accounts for player count.'],
    ['Zero', 'Red (#df1c2d); no more discards can occur while preserving the maximum score.'],
    ['Unavailable', 'Normal text color. Pace is suppressed when the final round has effectively started, in All or Nothing, or when authoritative Pace is unavailable.'],
  ];

  return <Modal animationType="fade" onRequestClose={onClose} statusBarTranslucent transparent visible={visible}>
    <View style={[styles.backdrop, { backgroundColor: theme.colors.overlay }]}>
      <View style={[styles.sheet, { backgroundColor: theme.colors.surfaceRaised, borderColor: theme.colors.borderStrong }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.colors.text }]}>Pace details</Text>
          <ActionButton compact title="Close" onPress={onClose} />
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={[styles.value, { color: theme.colors.text }]}>Pace value: {pace}</Text>
          <Text style={[styles.body, { color: theme.colors.text }]}>Current risk: {risk}</Text>
          <Text style={[styles.body, { color: theme.colors.text }]}>Meaning: Pace is the number of discards that can still happen while preserving the maximum score.</Text>
          <Text style={[styles.body, { color: theme.colors.text }]}>Formula: score + deck size - max score + final-round length</Text>
          <Text style={[styles.section, { color: theme.colors.text }]}>Risk and color</Text>
          {explanations.map(([label, explanation]) => <Text key={label} style={[styles.body, { color: theme.colors.text }]}>{label}: {explanation}</Text>)}
        </ScrollView>
      </View>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center', padding: 18 },
  sheet: { borderRadius: 14, borderWidth: 1, gap: 10, maxHeight: '86%', padding: 14 },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  title: { fontSize: 17, fontWeight: '900' },
  content: { gap: 9 },
  value: { fontSize: 15, fontWeight: '900' },
  section: { fontSize: 14, fontWeight: '800' },
  body: { fontSize: 13, lineHeight: 19 },
});
