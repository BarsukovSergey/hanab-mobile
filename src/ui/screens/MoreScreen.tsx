import { StyleSheet, Text, View } from 'react-native';

import { version } from '../../../package.json';
import { ActionButton, Panel, SectionHeading, useHanabTheme } from '../designSystem';

type MoreSurface = 'root' | 'tools' | 'about';

export function MoreScreen({ surface, username, onBack, onSettings, onTools, onAbout, onHomeTools, onHistoryTools, showEmbeddedBack = true }: {
  surface: MoreSurface;
  username: string;
  onBack: () => void;
  showEmbeddedBack?: boolean;
  onSettings: () => void;
  onTools: () => void;
  onAbout: () => void;
  onHomeTools: () => void;
  onHistoryTools: () => void;
}) {
  const { theme } = useHanabTheme();
  if (surface === 'tools') return <View style={styles.screen}>
    {showEmbeddedBack && <ActionButton compact title="Back" onPress={onBack} />}
    <Panel>
      <SectionHeading title="Tools" detail="Open an existing task in its browsing destination." />
      <ActionButton title="Open game link in Home" onPress={onHomeTools} />
      <ActionButton title="Open replay or import in History" onPress={onHistoryTools} />
    </Panel>
  </View>;
  if (surface === 'about') return <View style={styles.screen}>
    {showEmbeddedBack && <ActionButton compact title="Back" onPress={onBack} />}
    <Panel><SectionHeading title="About" />
      <Text style={{ color: theme.colors.text }}>Hanab Mobile</Text>
      <Text style={{ color: theme.colors.textMuted }}>Version {version}</Text>
    </Panel>
  </View>;
  return <View style={styles.screen}>
    <Panel>
      <SectionHeading title="More" detail={'Signed in as ' + username} />
      <ActionButton title="Settings" onPress={onSettings} />
      <ActionButton title="Tools" onPress={onTools} />
      <ActionButton title="About / version" onPress={onAbout} />
    </Panel>
  </View>;
}

const styles = StyleSheet.create({ screen: { gap: 14 } });
