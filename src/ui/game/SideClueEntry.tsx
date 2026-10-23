import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';
import { useHanabTheme } from '../designSystem';
import { getSideClueSize, sideClueNativeFits } from './sideClueLayout';

/** The visible name-over-Clue block is one distinct, measured 48dp minimum target. */
export function SideClueEntry({ playerName, children, availableHeight, fontScale, disabled, onPress }: {
  playerName: string; children: ReactNode; availableHeight: number; fontScale: number; disabled: boolean; onPress: () => void;
}) {
  const { theme } = useHanabTheme();
  const size = getSideClueSize(fontScale);
  const measurementKey = `${fontScale}:${availableHeight}`;
  const [measurement, setMeasurement] = useState({ key: '', box: { width: 0, height: 0 }, text: { width: 0, height: 0 } });
  const consumed = useRef(false);
  useEffect(() => {
    const app = AppState.addEventListener('change', state => { if (state !== 'active') consumed.current = true; });
    const dimensions = Dimensions.addEventListener('change', () => { consumed.current = true; });
    return () => { consumed.current = true; app.remove(); dimensions.remove(); };
  }, []);
  const fits = measurement.key === measurementKey && sideClueNativeFits(availableHeight, measurement.box, measurement.text, fontScale);
  const update = (kind: 'box' | 'text', value: { width: number; height: number }) => setMeasurement(current => ({
    ...(current.key === measurementKey ? current : { key: measurementKey, box: { width: 0, height: 0 }, text: { width: 0, height: 0 } }), [kind]: value,
  }));
  return <Pressable
    testID={`clue-entry-${playerName}`}
    accessibilityRole="button" accessibilityLabel={`Clue to ${playerName}`} accessibilityState={{ disabled: disabled || !fits }}
    disabled={disabled || !fits}
    onLayout={event => update('box', event.nativeEvent.layout)}
    onPressIn={event => { event.stopPropagation(); consumed.current = false; }}
    delayLongPress={350}
    onLongPress={event => { event.stopPropagation(); consumed.current = true; }}
    onTouchCancel={() => { consumed.current = true; }}
    onBlur={() => { consumed.current = true; }}
    onPress={event => { event.stopPropagation(); if (!disabled && fits && !consumed.current) onPress(); }}
    style={[styles.control, { width: size.width, height: size.height, borderColor: theme.colors.borderStrong, backgroundColor: theme.colors.surfaceRaised, opacity: disabled || !fits ? 0.55 : 1 }]}
  >
    <View style={{ height: size.lineHeight, width: '100%', justifyContent: 'center' }}>{children}</View>
    <Text numberOfLines={1} style={[styles.clue, { color: theme.colors.accent, height: size.lineHeight }]}>Clue</Text>
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.probe}>
      <Text testID={`clue-entry-text-${playerName}`} onLayout={event => update('text', event.nativeEvent.layout)} style={styles.clue}>Clue</Text>
    </View>
  </Pressable>;
}
const styles = StyleSheet.create({
  control: { alignItems: 'center', justifyContent: 'center', flexShrink: 0, borderRadius: 6, borderWidth: 1, paddingHorizontal: 3, gap: 2 },
  clue: { fontSize: 12, lineHeight: 14, fontWeight: '900', includeFontPadding: false },
  probe: { position: 'absolute', width: 1000, alignItems: 'flex-start', opacity: 0, top: 0, left: 0 },
});
