import { StyleSheet, Text, View } from 'react-native';

import { ActionButton, Panel, SectionHeading, ThemeSwitcher, useHanabTheme } from '../designSystem';

export function SettingsScreen({ onBack }: { onBack: () => void }) {
  const { theme } = useHanabTheme();
  return <View style={styles.screen}>
    <View style={styles.header}>
      <SectionHeading title="Settings" detail="App preferences that should stay out of the gameplay HUD." />
      <ActionButton compact title="Back" onPress={onBack} />
    </View>
    <Panel>
      <SectionHeading title="Appearance" detail="Choose how Hanab follows the device theme." />
      <ThemeSwitcher />
      <Text style={[styles.note, { color: theme.colors.textMuted }]}>Theme persistence is not enabled yet because the app does not currently ship a storage dependency.</Text>
    </Panel>
  </View>;
}

const styles = StyleSheet.create({
  screen: { gap: 14 },
  header: { alignItems: 'center', flexDirection: 'row', gap: 12, justifyContent: 'space-between' },
  note: { fontSize: 12, lineHeight: 17 },
});
