import { StyleSheet, Text, View } from 'react-native';

import { isCluePreviewConfirmable, type CluePreview } from '../../game/selectors/cluePreview';
import type { GameplayClueChoices } from '../../game/selectors/gameplay';
import { ActionButton, useHanabTheme, useResponsiveLayout } from '../designSystem';
import type { GameplayCluePreviewState } from './gameplayInteraction';

export function ClueComposer({
  targetName,
  choices,
  enabled,
  confirmEnabled,
  previewState,
  preview,
  onPreview,
  onClear,
  onConfirm,
}: {
  targetName: string | null;
  choices: GameplayClueChoices | null;
  enabled: boolean;
  confirmEnabled?: boolean;
  previewState: GameplayCluePreviewState;
  preview: CluePreview | null;
  onPreview: (type: 'color' | 'rank', value: number) => void;
  onClear: () => void;
  onConfirm: () => void;
}) {
  const { theme } = useHanabTheme();
  const { width, height } = useResponsiveLayout();
  const landscapePhone = width > height && height < 700;
  const previewLabel = previewState === null
    ? null
    : previewState.type === 'color'
      ? choices?.colors.find((choice) => choice.value === previewState.value)?.label ?? `Color ${previewState.value}`
      : choices?.ranks.find((choice) => choice.value === previewState.value)?.label ?? String(previewState.value);
  const allowEmptyClues = choices?.allowEmptyClues ?? false;
  const validPreview = isCluePreviewConfirmable(preview, allowEmptyClues);
  const confirmAllowed = confirmEnabled ?? enabled;

  if (targetName === null) {
    return <View style={[
      styles.idleSurface,
      landscapePhone && styles.idleSurfaceLandscape,
      { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
    ]}>
      <Text style={[styles.eyebrow, { color: theme.colors.textMuted }]}>CLUE</Text>
      <Text numberOfLines={1} style={[styles.idleText, { color: theme.colors.textMuted }]}>Tap a player name to choose a clue target</Text>
    </View>;
  }

  return <View style={[
    styles.surface,
    landscapePhone && styles.surfaceLandscape,
    { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
  ]}>
    <View style={styles.header}>
      <View style={styles.headerCopy}>
        <Text style={[styles.eyebrow, { color: theme.colors.textMuted }]}>CLUE TO</Text>
        <Text numberOfLines={1} style={[styles.target, landscapePhone && styles.targetLandscape, { color: theme.colors.text }]}>{targetName}</Text>
      </View>
      {previewState !== null && <ActionButton compact title="Cancel" tone="ghost" onPress={onClear} />}
    </View>
    {previewState === null ? <View style={styles.choiceGroups}>
      <View style={[styles.choiceRow, landscapePhone && styles.choiceRowLandscape]}>{choices?.colors.map((choice) => <ActionButton
        compact
        disabled={!enabled}
        key={`color-${choice.value}`}
        title={choice.label}
        onPress={() => onPreview('color', choice.value)}
      />)}</View>
      <View style={[styles.choiceRow, landscapePhone && styles.choiceRowLandscape]}>{choices?.ranks.map((choice) => <ActionButton
        compact
        disabled={!enabled}
        key={`rank-${choice.value}`}
        title={choice.label}
        onPress={() => onPreview('rank', choice.value)}
      />)}</View>
    </View> : <View style={styles.confirmRow}>
      <View style={styles.previewCopy}>
        <Text style={[styles.previewTitle, { color: theme.colors.text }]}>{previewLabel}</Text>
        <Text style={[styles.previewDetail, { color: validPreview ? theme.colors.textMuted : theme.colors.danger }]}>
          {preview === null
            ? 'Invalid clue preview'
            : preview.touchedOrders.length === 0
              ? allowEmptyClues
                ? 'No cards touched — Empty Clues allows this clue'
                : 'No cards touched — enable Empty Clues to give this clue'
              : `${preview.touchedOrders.length} card${preview.touchedOrders.length === 1 ? '' : 's'} touched`}
        </Text>
      </View>
      <ActionButton disabled={!confirmAllowed || !validPreview} title="Give clue" tone="primary" onPress={onConfirm} />
    </View>}
  </View>;
}

const styles = StyleSheet.create({
  idleSurface: { alignItems: 'center', borderRadius: 10, borderWidth: 1, flexDirection: 'row', gap: 8, paddingHorizontal: 9, paddingVertical: 7 },
  idleSurfaceLandscape: { paddingHorizontal: 7, paddingVertical: 4 },
  idleText: { flex: 1, fontSize: 10, fontWeight: '700' },
  surface: { borderRadius: 12, borderWidth: 1, gap: 8, padding: 10 },
  surfaceLandscape: { gap: 4, padding: 6 },
  header: { alignItems: 'center', flexDirection: 'row', gap: 8, justifyContent: 'space-between' },
  headerCopy: { flex: 1, minWidth: 0 },
  eyebrow: { fontSize: 9, fontWeight: '900', letterSpacing: 0.9 },
  target: { fontSize: 14, fontWeight: '900' },
  targetLandscape: { fontSize: 12 },
  choiceGroups: { gap: 5 },
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  choiceRowLandscape: { gap: 4 },
  confirmRow: { alignItems: 'center', flexDirection: 'row', gap: 10, justifyContent: 'space-between' },
  previewCopy: { flex: 1, minWidth: 0 },
  previewTitle: { fontSize: 15, fontWeight: '900' },
  previewDetail: { fontSize: 11, lineHeight: 15 },
});
