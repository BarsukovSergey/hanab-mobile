import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useHanabTheme } from '../designSystem';

type Props = {
  actionSegments: readonly number[];
  selectedSegment: number;
  onSelectSegment: (segment: number) => void;
};

const NAVIGATION_INTERVAL_MS = 80;

export function C17RewindScrubber({ actionSegments, selectedSegment, onSelectSegment }: Props) {
  const { theme } = useHanabTheme();
  const [trackWidth, setTrackWidth] = useState(0);
  const timelineSegments = useMemo(() => (
    actionSegments[0] === 0 ? [...actionSegments] : [0, ...actionSegments]
  ), [actionSegments]);
  const selectedIndex = Math.max(0, timelineSegments.indexOf(selectedSegment));
  const [previewIndex, setPreviewIndex] = useState(selectedIndex);
  const dragging = useRef(false);
  const lastEmittedIndex = useRef(selectedIndex);
  const lastNavigationAt = useRef(0);

  useEffect(() => {
    lastEmittedIndex.current = selectedIndex;
    if (!dragging.current) setPreviewIndex(selectedIndex);
  }, [selectedIndex]);

  if (timelineSegments.length === 0) return null;

  const maxIndex = Math.max(1, timelineSegments.length - 1);
  const progress = timelineSegments.length <= 1 ? 0 : previewIndex / maxIndex;
  const indexFromX = (x: number) => {
    if (trackWidth <= 0) return null;
    const clampedX = Math.max(0, Math.min(trackWidth, x));
    return Math.max(
      0,
      Math.min(
        timelineSegments.length - 1,
        Math.round((clampedX / trackWidth) * maxIndex),
      ),
    );
  };
  const emitIndex = (index: number, force: boolean) => {
    const now = Date.now();
    if (!force && now - lastNavigationAt.current < NAVIGATION_INTERVAL_MS) return;
    if (index === lastEmittedIndex.current) return;
    const segment = timelineSegments[index];
    if (segment === undefined) return;
    lastEmittedIndex.current = index;
    lastNavigationAt.current = now;
    onSelectSegment(segment);
  };
  const scrubToX = (x: number, force: boolean) => {
    const index = indexFromX(x);
    if (index === null) return;
    setPreviewIndex((current) => current === index ? current : index);
    emitIndex(index, force);
  };

  return <View style={styles.root}>
    <Text style={[styles.edgeLabel, { color: theme.colors.textMuted }]}>T0</Text>
    <View
      accessibilityLabel="Rewind timeline"
      accessibilityRole="adjustable"
      accessibilityValue={{ min: 0, max: timelineSegments.length - 1, now: previewIndex }}
      onLayout={({ nativeEvent: { layout } }) => setTrackWidth(layout.width)}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={(event) => {
        dragging.current = true;
        scrubToX(event.nativeEvent.locationX, true);
      }}
      onResponderMove={(event) => scrubToX(event.nativeEvent.locationX, false)}
      onResponderRelease={(event) => {
        scrubToX(event.nativeEvent.locationX, true);
        dragging.current = false;
      }}
      onResponderTerminate={(event) => {
        scrubToX(event.nativeEvent.locationX, true);
        dragging.current = false;
      }}
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