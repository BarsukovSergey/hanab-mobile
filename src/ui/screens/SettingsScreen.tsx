import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ActionButton, Panel, SectionHeading, ThemeSwitcher } from '../designSystem';
import { GameplayScenarioGallery } from '../game/scenarios/GameplayScenarioGallery';

export function SettingsScreen({ onBack }: { onBack: () => void }) {
  const [scenarioGalleryOpen, setScenarioGalleryOpen] = useState(false);

  if (__DEV__ && scenarioGalleryOpen) {
    return <GameplayScenarioGallery onBack={() => setScenarioGalleryOpen(false)} />;
  }

  return <View style={styles.screen}>
    <View style={styles.header}>
      <SectionHeading title="Settings" detail="App preferences." />
      <ActionButton compact title="Back" onPress={onBack} />
    </View>
    <Panel>
      <SectionHeading title="Appearance" detail="Choose how Hanab follows the device theme." />
      <ThemeSwitcher />
    </Panel>
    {__DEV__ && <Panel>
      <SectionHeading title="Developer" detail="Render canonical gameplay states without joining a live table." />
      <ActionButton title="Gameplay scenarios" onPress={() => setScenarioGalleryOpen(true)} />
    </Panel>}
  </View>;
}

const styles = StyleSheet.create({
  screen: { gap: 14 },
  header: { alignItems: 'center', flexDirection: 'row', gap: 12, justifyContent: 'space-between' },
});
