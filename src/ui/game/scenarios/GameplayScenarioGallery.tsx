import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Provider } from 'react-redux';

import { suppressGameplayRuntimeCommands } from '../../../runtime/application';
import { ActionButton, Panel, SectionHeading, useHanabTheme } from '../../designSystem';
import { GameScreen } from '../GameScreen';
import { getEmptyClueGalleryScenarios } from './emptyClueGalleryScenarios';
import { getGameplayGalleryScenarios } from './gameplayScenarios';

export function GameplayScenarioGallery({ onBack }: { onBack: () => void }) {
  const { theme } = useHanabTheme();
  const scenarios = useMemo(
    () => [...getGameplayGalleryScenarios(), ...getEmptyClueGalleryScenarios()],
    [],
  );
  const [selectedID, setSelectedID] = useState(scenarios[0]?.id ?? '');
  const scenario = useMemo(
    () => scenarios.find((candidate) => candidate.id === selectedID) ?? scenarios[0],
    [scenarios, selectedID],
  );

  useEffect(() => suppressGameplayRuntimeCommands(), []);

  if (scenario === undefined) return null;

  return <View style={styles.screen}>
    <View style={styles.header}>
      <SectionHeading title="Gameplay scenarios" detail="Real headless-client fixtures rendered through the production GameScreen." />
      <ActionButton compact title="Back" onPress={onBack} />
    </View>

    <Panel>
      <View style={styles.scenarioButtons}>
        {scenarios.map((candidate) => <ActionButton
          compact
          key={candidate.id}
          title={candidate.title}
          tone={candidate.id === scenario.id ? 'primary' : 'secondary'}
          onPress={() => setSelectedID(candidate.id)}
        />)}
      </View>
      <Text style={[styles.description, { color: theme.colors.textMuted }]}>{scenario.description}</Text>
      <Text style={[styles.viewportLabel, { color: theme.colors.textMuted }]}>
        Canonical layout target: {scenario.viewport.width} x {scenario.viewport.height}. Gallery render uses the current device viewport.
      </Text>
      <Text style={[styles.warning, { color: theme.colors.warning }]}>
        Scenario stores are isolated and gameplay/postgame runtime commands are suppressed while this gallery is open. Local selection, preview, empathy, notes, discard inspection, Empty Clues confirmation state, and finished/replay rendering remain safe to exercise.
      </Text>
    </Panel>

    <View style={[styles.gameFrame, { borderColor: theme.colors.borderStrong }]}>
      <Provider store={scenario.store}>
        <GameScreen key={scenario.id} />
      </Provider>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  screen: { gap: 12 },
  header: { alignItems: 'center', flexDirection: 'row', gap: 12, justifyContent: 'space-between' },
  scenarioButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  description: { fontSize: 12, lineHeight: 17 },
  viewportLabel: { fontSize: 11, fontWeight: '700', lineHeight: 16 },
  warning: { fontSize: 11, lineHeight: 16 },
  gameFrame: { borderRadius: 12, borderWidth: 1, overflow: 'hidden', padding: 8 },
});
