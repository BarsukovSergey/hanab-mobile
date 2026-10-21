import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useHanabTheme } from './designSystem';
import { measureBrowsingAppBar, SURFACE_METRICS } from './responsiveSurface';
import type { RoomReturnPresentation } from './roomReturnPresentation';

const RETURN_STATUS_LABELS = [
  'PLAYER · 6/6', 'SPECTATOR · 6/6', 'Loading game', 'Reconnecting',
  'HYPOTHETICAL', 'REWIND', 'Finished · 99', 'REPLAY', 'SHARED REVIEW',
  'YOUR TURN', 'LIVE · T9999',
];
const RETURN_ACTION_LABELS = [
  'Return to table', 'Return to room', 'Return to hypothetical',
  'Return to Live', 'Review game', 'Return to review', 'Return to game',
];

export function BrowsingAppBar({ title, username, onBack, returnPresentation, onReturn }: {
  title: string;
  username: string | null;
  onBack?: () => void;
  returnPresentation?: RoomReturnPresentation | null;
  onReturn: () => void;
}) {
  const { theme } = useHanabTheme();
  const [availableWidth, setAvailableWidth] = useState(0);
  const [backLabelWidth, setBackLabelWidth] = useState(0);
  const [titleWidth, setTitleWidth] = useState(0);
  const [statusWidths, setStatusWidths] = useState<Record<string, number>>({});
  const [actionWidths, setActionWidths] = useState<Record<string, number>>({});
  const returnSlotWidth = Math.max(
    ...RETURN_STATUS_LABELS.map((label) => statusWidths[label] ?? 0),
    ...RETURN_ACTION_LABELS.map((label) => actionWidths[label] ?? 0),
  );
  const hasReturn = returnPresentation != null;
  const measurementsReady = availableWidth > 0 && titleWidth > 0
    && (!onBack || backLabelWidth > 0)
    && (!hasReturn || (Object.keys(statusWidths).length === RETURN_STATUS_LABELS.length
      && Object.keys(actionWidths).length === RETURN_ACTION_LABELS.length));
  const { presentation } = measurementsReady
    ? measureBrowsingAppBar(availableWidth, backLabelWidth, titleWidth, returnSlotWidth, !!onBack, hasReturn)
    : { presentation: 'stacked' as const };

  return <View onLayout={(event) => setAvailableWidth(event.nativeEvent.layout.width)}
    style={[styles.root, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
      pointerEvents="none" style={styles.measurementLayer}>
      <Text onLayout={(event) => setBackLabelWidth(event.nativeEvent.layout.width)} style={styles.backLabel}>Back</Text>
      <Text onLayout={(event) => setTitleWidth(event.nativeEvent.layout.width)} style={styles.title}>{title}</Text>
      {RETURN_STATUS_LABELS.map((label) => <Text key={label} style={styles.status}
        onLayout={(event) => {
          const width = event.nativeEvent.layout.width;
          setStatusWidths((current) => current[label] === width
            ? current : { ...current, [label]: width });
        }}>{label}</Text>)}
      {RETURN_ACTION_LABELS.map((label) => <Text key={label} style={styles.action}
        onLayout={(event) => {
          const width = event.nativeEvent.layout.width;
          setActionWidths((current) => current[label] === width
            ? current : { ...current, [label]: width });
        }}>{label}</Text>)}
    </View>
    <View style={styles.mainRow}>
      {onBack && <Pressable accessibilityRole="button" onPress={onBack} style={styles.backButton}>
        <Text style={[styles.backLabel, { color: theme.colors.accent }]}>Back</Text>
      </Pressable>}
      <View style={styles.identity}>
        <Text style={[styles.title, { color: theme.colors.text }]}>{title}</Text>
        {username !== null && <Text style={[styles.username, { color: theme.colors.textMuted }]}>{username}</Text>}
      </View>
      {hasReturn && presentation === 'one-row' && <Pressable accessibilityRole="button"
        onPress={onReturn} style={[styles.returnButton, { borderColor: theme.colors.accent }]}>
        <Text style={[styles.status, { color: theme.colors.accent }]}>{returnPresentation.status}</Text>
        <Text style={[styles.action, { color: theme.colors.text }]}>{returnPresentation.action}</Text>
      </Pressable>}
    </View>
    {hasReturn && presentation === 'stacked' && <Pressable accessibilityRole="button"
      onPress={onReturn} style={[styles.returnButton, styles.stackedReturn, { borderColor: theme.colors.accent }]}>
      <Text style={[styles.status, { color: theme.colors.accent }]}>{returnPresentation.status}</Text>
      <Text style={[styles.action, { color: theme.colors.text }]}>{returnPresentation.action}</Text>
    </Pressable>}
  </View>;
}

const styles = StyleSheet.create({
  root: { borderBottomWidth: 1, gap: 8, minHeight: SURFACE_METRICS.browsingAppBarMinHeight, paddingHorizontal: 16, paddingVertical: 6 },
  mainRow: { alignItems: 'center', flexDirection: 'row', gap: 12, minHeight: 48 },
  backButton: { alignItems: 'center', justifyContent: 'center', minHeight: 48, minWidth: 48, paddingHorizontal: 12 },
  backLabel: { fontSize: 14, fontWeight: '700' },
  identity: { flex: 1, minWidth: 0 },
  title: { fontSize: 18, fontWeight: '800' },
  username: { fontSize: 12 },
  returnButton: { alignItems: 'flex-start', borderRadius: 10, borderWidth: 1, justifyContent: 'center', minHeight: SURFACE_METRICS.primaryTouchTarget, paddingHorizontal: 12, paddingVertical: 5 },
  stackedReturn: { alignSelf: 'stretch' },
  status: { fontSize: 11, fontWeight: '800' },
  action: { fontSize: 14, fontWeight: '700' },
  measurementLayer: { alignItems: 'flex-start', left: -10000, opacity: 0, position: 'absolute', top: 0 },
});
