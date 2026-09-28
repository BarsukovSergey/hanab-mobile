import { StyleSheet, View } from 'react-native';

import { ActionButton, useHanabTheme, useResponsiveLayout } from './designSystem';
import { measureNavigation } from './responsiveSurface';
import type { BrowsingDestination } from './browsingNavigationState';

const destinations: { key: BrowsingDestination; label: string }[] = [
  { key: 'home', label: 'Home' },
  { key: 'history', label: 'History' },
  { key: 'people', label: 'People' },
  { key: 'more', label: 'More' },
];

export function BrowsingNavigation({ destination, onNavigate }: {
  destination: BrowsingDestination;
  onNavigate: (destination: BrowsingDestination) => void;
}) {
  const { theme } = useHanabTheme();
  const { windowClass, availableWidth } = useResponsiveLayout();
  const bottom = windowClass === 'compact';
  const bottomHeight = bottom ? measureNavigation('bottom', 64, 20, availableWidth).height : 0;
  const railWidth = bottom ? 0 : measureNavigation('rail', 64, 20).width;
  return <View accessibilityRole="tablist" style={[
    bottom ? styles.bottom : styles.rail,
    { borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
    bottom ? { minHeight: bottomHeight } : { width: railWidth },
  ]}>
    {destinations.map(({ key, label }) => <View key={key} style={bottom ? styles.bottomItem : styles.railItem}>
      <ActionButton compact title={label} tone={destination === key ? 'primary' : 'ghost'}
        onPress={() => onNavigate(key)} style={styles.button} />
    </View>)}
  </View>;
}

const styles = StyleSheet.create({
  bottom: { borderTopWidth: 1, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-around', padding: 6 },
  rail: { borderRightWidth: 1, gap: 8, padding: 6 },
  bottomItem: { flexBasis: '25%', minWidth: 72 },
  railItem: { width: '100%' },
  button: { minHeight: 48 },
});
