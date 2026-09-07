import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useHanabTheme } from '../designSystem';

type Props = {
  actionSegments: readonly number[];
  selectedSegment: number;
  onSelectSegment: (segment: number) => void;
};

export function C17RewindScrubber({ actionSegments, selectedSegment, onSelectSegment }: Props) {
  const { theme } = useHanabTheme();
  const [trackWidth, setTrackWidth] = useState(0);
  const selectedIndex = Math.max(0, actionSegments.indexOf(selectedSegment));
  const lastEmittedIndex = useRef(selectedIndex);

  useEffect(() => {
    lastEmittedIndex.current = selectedIndex;
  }, [selectedIndex]);

  if (actionSegments.length === 0) return null;

  const maxIndex = Math.max(1, actionSegments.length - 1);
  const progress = actionSegments.length <= 1 ? 0 : selectedIndex / maxIndex;
  const selectFromX = (x: number) => {
    if (trackWidth <= 0) return;
    const clampedX = Math.max(0, Math.min(trackWidth, x));
    const index = Math.max(0, Math.min(actionSegments.length - 1, Math.round((clampedX / trackWidth) * maxIndex)));
    if (index === lastEmittedIndex.current) return;
    const segment = actionSegments[index];
    if (segment === undefined) return;
    lastEmittedIndex.current = index;
    onSelectSegment(segment);
  };

  return <View style={styles.root}>
    <Text style={[styles.edgeLabel, { color: theme.colors.textMuted }]}>Start</Text>
    <View
      accessibilityLabel="Rewind timeline"
      accessibilityRole="adjustable"
      accessibilityValue={{ min: 1, max: actionSegments.length, now: selectedIndex + 1 }}
      onLayout={({ nativeEvent: { layout } }) => setTrackWidth(layout.width)}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={(event) => selectFromX(event.nativeEvent.locationX)}
      onResponderMove={(event) => selectFromX(event.nativeEvent.locationX)}
      onResponderRelease={(event) => selectFromX(event.nativeEvent.locationX)}
      onStartShouldSetResponder={() => true}
      style={styles.touchTrack}
    >
      <View style={[styles.track, { backgroundColor: theme.colors.borderStrong }]}>
        <View style={[styles.fill, { backgroundColor: theme.colors.accent, width: `${progress * 100}%` }]} />
        <View style={[
          styles.thumb,
          {
            backgroundColor: theme.colors.surfaceRaised,
            borderColor: theme.colors.accent,
            left: `${progress * 100}%`,
          },
        ]} />
      </View>
    </View>
    <Text style={[styles.edgeLabel, { color: theme.colors.textMuted }]}>Latest</Text>
  </View>;
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', flexDirection: 'row', gap: 7, width: '100%' },
  edgeLabel: { fontSize: 8, fontWeight: '800' },
  touchTrack: { flex: 1, justifyContent: 'center', minHeight: 32, minWidth: 0 },
  track: { borderRadius: 999, height: 5, position: 'relative', width: '100%' },
  fill: { borderRadius: 999, height: 5 },
  thumb: {
    borderRadius: 999,
    borderWidth: 2,
    height: 18,
    marginLeft: -9,
    marginTop: -11.5,
    position: 'absolute',
    top: '50%',
    width: 18,
  },
});
