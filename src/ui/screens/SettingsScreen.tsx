import { useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';

import { lobbyRuntime } from '../../runtime/application';
import { useAppSelector } from '../../store/hooks';
import { ActionButton, Panel, SectionHeading, ThemeSwitcher, useHanabTheme } from '../designSystem';
import { GameplayScenarioGallery } from '../game/scenarios/GameplayScenarioGallery';

export function SettingsScreen({ onBack }: { onBack: () => void }) {
  const [scenarioGalleryOpen, setScenarioGalleryOpen] = useState(false);
  const presentation = useAppSelector((state) => state.session.cardPresentationSettings);
  const { theme } = useHanabTheme();

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
    <Panel>
      <SectionHeading
        title="Card appearance"
        detail="Colorblind mode takes presentation precedence when both options are enabled."
      />
      <View style={styles.settingRow}>
        <Text style={[styles.settingLabel, { color: theme.colors.text }]}>Colorblind mode</Text>
        <Switch
          accessibilityLabel="Colorblind mode"
          accessibilityRole="switch"
          onValueChange={(enabled) => {
            lobbyRuntime.setCardPresentationSetting('colorblindMode', enabled);
          }}
          value={presentation.colorblindMode}
        />
      </View>
      <View style={styles.settingRow}>
        <Text style={[styles.settingLabel, { color: theme.colors.text }]}>Styled card numbers</Text>
        <Switch
          accessibilityLabel="Styled card numbers"
          accessibilityRole="switch"
          onValueChange={(enabled) => {
            lobbyRuntime.setCardPresentationSetting('styleNumbers', enabled);
          }}
          value={presentation.styleNumbers}
        />
      </View>
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
  settingLabel: { flex: 1, fontSize: 15, fontWeight: '600' },
  settingRow: { alignItems: 'center', flexDirection: 'row', gap: 12, justifyContent: 'space-between', minHeight: 44 },
});
