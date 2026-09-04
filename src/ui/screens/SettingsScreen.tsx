import { StyleSheet, View } from 'react-native';

import { ActionButton, Panel, SectionHeading, ThemeSwitcher } from '../designSystem';

export function SettingsScreen({ onBack }: { onBack: () => void }) {
  return <View style={styles.screen}>
    <View style={styles.header}>
      <SectionHeading title="Settings" detail="App preferences." />
      <ActionButton compact title="Back" onPress={onBack} />
    </View>
    <Panel>
      <SectionHeading title="Appearance" detail="Choose how Hanab follows the device theme." />
      <ThemeSwitcher />
    </Panel>
  </View>;
}

const styles = StyleSheet.create({
  screen: { gap: 14 },
  header: { alignItems: 'center', flexDirection: 'row', gap: 12, justifyContent: 'space-between' },
});
