import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useHanabTheme } from '../designSystem';

type Props = {
  actionSegments: readonly number[];
  selectedSegment: number;
  onSelectSegment: (segment: number) => void;
};

export const gestureOriginFromGrant = (pageX: number, locationX: number) => pageX - locationX;
export const scrubXFromPage = (pageX: number, originX: number) => pageX - originX;

export function C17RewindScrubber({ actionSegments, selectedSegment, onSelectSegment }: Props) {
  const { theme } = useHanabTheme();
  const [trackWidth, setTrackWidth] = useState(0);
  const timelineSegments = useMemo(() => (
    actionSegments[0] === 0 ? [...actionSegments] : [0, ...actionSegments]
  ), [actionSegments]);
  const selectedIndex = Math.max(0, timelineSegments.indexOf(selectedSegment));
  const [previewIndex, setPreviewIndex] = useState(selectedIndex);
  const dragging = useRef(false);
  const gestureOriginX = useRef<number | null>(null);
  const lastEmittedIndex = useRef(selectedIndex);
  const pendingIndex = useRef<number | null>(null);
  const navigationFrame = useRef<number | null>(null);

  useEffect(() => {
    lastEmittedIndex.current = selectedIndex;
    if (!dragging.current) setPreviewIndex(selectedIndex);
  }, [selectedIndex]);

  useEffect(() => () => {
    if (navigationFrame.current !== null) cancelAnimationFrame(navigationFrame.current);
  }, []);

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
  const emitIndex = (index: number) => {
    if (index === lastEmittedIndex.current) return;
    const segment = timelineSegments[index];
    if (segment === undefined) return;
    lastEmittedIndex.current = index;
    onSelectSegment(segment);
  };
  const scheduleIndex = (index: number) => {
    pendingIndex.current = index;
    if (navigationFrame.current !== null) return;
    navigationFrame.current = requestAnimationFrame(() => {
      navigationFrame.current = null;
      const nextIndex = pendingIndex.current;
      pendingIndex.current = null;
      if (nextIndex !== null) emitIndex(nextIndex);
    });
  };
  const flushIndex = (index: number) => {
    pendingIndex.current = null;
    if (navigationFrame.current !== null) {
      cancelAnimationFrame(navigationFrame.current);
      navigationFrame.current = null;
    }
    emitIndex(index);
  };
  const scrubToX = (x: number, final: boolean) => {
    const index = indexFromX(x);
    if (index === null) return;
    setPreviewIndex((current) => current === index ? current : index);
    if (final) flushIndex(index);
    else scheduleIndex(index);
  };

  return <View style={styles.root}>
    <Text style={[styles.edgeLabel, { color: theme.colors.textMuted }]}>T0</Text>
    <View
      accessibilityLabel="Rewind timeline"
      accessibilityRole="adjustable"
      accessibilityValue={{ min: 0, max: timelineSegments.length - 1, now: previewIndex }}
      onLayout={({ nativeEvent: { layout } }) => setTrackWidth(layout.width)}
      onMoveShouldSetResponderCapture={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={(event) => {
        dragging.current = true;
        gestureOriginX.current = gestureOriginFromGrant(event.nativeEvent.pageX, event.nativeEvent.locationX);
        scrubToX(scrubXFromPage(event.nativeEvent.pageX, gestureOriginX.current), true);
      }}
      onResponderMove={(event) => {
        if (gestureOriginX.current === null) return;
        scrubToX(scrubXFromPage(event.nativeEvent.pageX, gestureOriginX.current), false);
      }}
      onResponderRelease={(event) => {
        if (gestureOriginX.current !== null) {
          scrubToX(scrubXFromPage(event.nativeEvent.pageX, gestureOriginX.current), true);
        }
        dragging.current = false;
        gestureOriginX.current = null;
      }}
      onResponderTerminate={(event) => {
        if (gestureOriginX.current !== null) {
          scrubToX(scrubXFromPage(event.nativeEvent.pageX, gestureOriginX.current), true);
        }
        dragging.current = false;
        gestureOriginX.current = null;
      }}
      onStartShouldSetResponderCapture={() => true}
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
