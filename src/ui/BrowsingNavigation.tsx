import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ActionButton, COMPACT_ACTION_BUTTON_LABEL_STYLE, useHanabTheme, useResponsiveLayout } from './designSystem';
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
  const [labelLayouts, setLabelLayouts] = useState<Record<BrowsingDestination, { width: number; height: number }>>({
    home: { width: 0, height: 0 }, history: { width: 0, height: 0 },
    people: { width: 0, height: 0 }, more: { width: 0, height: 0 },
  });
  const { theme } = useHanabTheme();
  const { windowClass, availableWidth } = useResponsiveLayout();
  const bottom = windowClass === 'compact';
  const labelWidth = Math.max(...Object.values(labelLayouts).map(({ width }) => width));
  const labelHeight = Math.max(...Object.values(labelLayouts).map(({ height }) => height));
  const bottomHeight = bottom ? measureNavigation('bottom', labelWidth, labelHeight, availableWidth).height : 0;
  const railWidth = bottom ? 0 : measureNavigation('rail', labelWidth, labelHeight).width;
  return <View accessibilityRole="tablist" style={[
    bottom ? styles.bottom : styles.rail,
    { borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
    bottom ? { minHeight: bottomHeight } : { width: railWidth },
  ]}>
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none" style={styles.measurementLayer}>
      {destinations.map(({ key, label }) => <Text key={key} onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        setLabelLayouts((current) => current[key].width === width && current[key].height === height
          ? current : { ...current, [key]: { width, height } });
      }} style={[COMPACT_ACTION_BUTTON_LABEL_STYLE, styles.measurementLabel]}>{label}</Text>)}
    </View>
    {destinations.map(({ key, label }) => <View key={key} style={bottom ? styles.bottomItem : styles.railItem}>
      <ActionButton compact title={label} tone={destination === key ? 'primary' : 'ghost'}
        onPress={() => onNavigate(key)} style={styles.button} />
    </View>)}
  </View>;
}

const styles = StyleSheet.create({
  bottom: { borderTopWidth: 1, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-around', padding: 6 },
  rail: { borderRightWidth: 1, gap: 8, padding: 6 },
  measurementLayer: { left: -10000, opacity: 0, position: 'absolute', top: 0 },
  measurementLabel: { alignSelf: 'flex-start' },
  bottomItem: { flexBasis: '25%', minWidth: 72 },
  railItem: { width: '100%' },
  button: { minHeight: 48 },
});
