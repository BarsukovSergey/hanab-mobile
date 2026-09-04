import { StyleSheet, Text, View } from 'react-native';

import type { CluePreview } from '../../game/selectors/cluePreview';
import type { GameplayClueChoices } from '../../game/selectors/gameplay';
import { ActionButton, useHanabTheme, useResponsiveLayout } from '../designSystem';
import type { GameplayCluePreviewState } from './gameplayInteraction';

export function ClueComposer({
  targetName,
  choices,
  enabled,
  previewState,
  preview,
  onPreview,
  onClear,
  onConfirm,
}: {
  targetName: string | null;
  choices: GameplayClueChoices | null;
  enabled: boolean;
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

  return <View style={[
    styles.surface,
    landscapePhone && styles.surfaceLandscape,
    { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
  ]}>
    <View style={styles.header}>
      <View style={styles.headerCopy}>
        <Text style={[styles.eyebrow, { color: theme.colors.textMuted }]}>CLUE</Text>
        <Text numberOfLines={1} style={[styles.target, landscapePhone && styles.targetLandscape, { color: theme.colors.text }]}>{targetName ?? 'Choose a player'}</Text>
      </View>
      {previewState !== null && <ActionButton compact title="Cancel" tone="ghost" onPress={onClear} />}
    </View>
    {previewState === null ? <View style={landscapePhone ? styles.landscapeChoices : undefined}>
      <View style={styles.choiceRow}>{choices?.colors.map((choice) => <ActionButton
        compact
        disabled={!enabled}
        key={`color-${choice.value}`}
        title={choice.label}
        onPress={() => onPreview('color', choice.value)}
      />)}</View>
      <View style={styles.choiceRow}>{choices?.ranks.map((choice) => <ActionButton
        compact
        disabled={!enabled}
        key={`rank-${choice.value}`}
        title={choice.label}
        onPress={() => onPreview('rank', choice.value)}
      />)}</View>
    </View> : <View style={styles.confirmRow}>
      <View style={styles.previewCopy}>
        <Text style={[styles.previewTitle, { color: theme.colors.text }]}>{previewLabel}</Text>
        <Text style={[styles.previewDetail, { color: theme.colors.textMuted }]}>
          {preview === null ? 'Invalid clue preview' : `${preview.touchedOrders.length} card${preview.touchedOrders.length === 1 ? '' : 's'} touched`}
        </Text>
      </View>
      <ActionButton disabled={!enabled || preview === null} title="Give clue" tone="primary" onPress={onConfirm} />
    </View>}
  </View>;
}

const styles = StyleSheet.create({
  surface: { borderRadius: 12, borderWidth: 1, gap: 8, padding: 10 },
  surfaceLandscape: { gap: 5, padding: 7 },
  header: { alignItems: 'center', flexDirection: 'row', gap: 8, justifyContent: 'space-between' },
  headerCopy: { flex: 1, minWidth: 0 },
  eyebrow: { fontSize: 9, fontWeight: '900', letterSpacing: 0.9 },
  target: { fontSize: 14, fontWeight: '900' },
  targetLandscape: { fontSize: 12 },
  landscapeChoices: { flexDirection: 'row', gap: 6 },
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  confirmRow: { alignItems: 'center', flexDirection: 'row', gap: 10, justifyContent: 'space-between' },
  previewCopy: { flex: 1, minWidth: 0 },
  previewTitle: { fontSize: 15, fontWeight: '900' },
  previewDetail: { fontSize: 11, lineHeight: 15 },
});
