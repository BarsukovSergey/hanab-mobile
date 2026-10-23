import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { isCluePreviewConfirmable, type CluePreview } from '../../game/selectors/cluePreview';
import type { GameplayClueChoices } from '../../game/selectors/gameplay';
import { getClueColorFill } from '../../game/selectors/gameplay';
import { ActionButton, useHanabTheme, useResponsiveLayout } from '../designSystem';
import type { GameplayCluePreviewState } from './gameplayInteraction';
import { getLandscapeWorkbenchEnvelope } from './landscapeWorkbench';

export function ClueComposer({
  targetName,
  dense = false,
  boundedLandscape = false,
  variantName = 'No Variant',
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
  dense?: boolean;
  boundedLandscape?: boolean;
  variantName?: string;
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
  const { width, height, fontScale = 1 } = useResponsiveLayout();
  const bounded = dense && boundedLandscape;
  const envelope = getLandscapeWorkbenchEnvelope(fontScale);
  const PaletteViewport = bounded ? ScrollView : View;
  const landscapePhone = width > height && height < 700;
  const allowEmptyClues = choices?.allowEmptyClues ?? false;
  const validPreview = isCluePreviewConfirmable(preview, allowEmptyClues, variantName);
  const confirmAllowed = confirmEnabled ?? enabled;

  if (targetName === null) {
    return <View style={[
      styles.idleSurface,
      landscapePhone && styles.idleSurfaceLandscape,
      { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
    ]}>
      <Text style={[styles.eyebrow, { color: theme.colors.textMuted }]}>CLUE</Text>
      <Text numberOfLines={1} style={[styles.idleText, { color: theme.colors.textMuted }]}>Tap a player to choose a clue target</Text>
    </View>;
  }

  return <View style={[
    styles.surface,
    landscapePhone && styles.surfaceLandscape,
    dense && styles.denseSurface,
    { backgroundColor: theme.colors.surfaceRaised, borderColor: theme.colors.borderStrong },
  ]}>
    {dense ? <View style={[styles.denseLayout, bounded && { height: envelope.composerHeight }]}>
      <View style={[styles.densePalette, bounded && { height: envelope.paletteHeight }]}>
        <PaletteViewport horizontal={bounded || undefined} nestedScrollEnabled={bounded || undefined} showsHorizontalScrollIndicator={false}
          accessibilityHint={bounded ? 'Scroll horizontally for more color choices' : undefined}
          contentContainerStyle={bounded ? [styles.choiceRow, styles.denseChoiceRow, { flexWrap: 'nowrap' }] : undefined}
          style={bounded ? { height: envelope.choiceHeight, flexGrow: 0 } : [styles.choiceRow, styles.denseChoiceRow]}>{choices?.colors.map((choice) => {
          const selected = previewState?.type === 'color' && previewState.value === choice.value;
          return <Pressable
            accessibilityLabel={choice.label}
            accessibilityRole="button"
            disabled={!enabled}
            hitSlop={{ top: 5, bottom: 5, left: 2, right: 2 }}
            key={`color-${choice.value}`}
            onPress={() => onPreview('color', choice.value)}
            style={[styles.denseColorChoice, bounded && { height: envelope.choiceHeight, width: envelope.choiceHeight }, { borderColor: selected ? theme.colors.accent : '#111111' }, !enabled && styles.choiceDisabled]}
          ><View style={[styles.colorSwatch, { backgroundColor: getClueColorFill(variantName, choice.value) ?? '#ffffff' }]} /></Pressable>;
        })}</PaletteViewport>
        <PaletteViewport horizontal={bounded || undefined} nestedScrollEnabled={bounded || undefined} showsHorizontalScrollIndicator={false}
          accessibilityHint={bounded ? 'Scroll horizontally for more rank choices' : undefined}
          contentContainerStyle={bounded ? [styles.choiceRow, styles.denseChoiceRow, { flexWrap: 'nowrap' }] : undefined}
          style={bounded ? { height: envelope.choiceHeight, flexGrow: 0 } : [styles.choiceRow, styles.denseChoiceRow]}>{choices?.ranks.map((choice) => {
          const selected = previewState?.type === 'rank' && previewState.value === choice.value;
          const label = choice.label === 'Odd' ? 'O' : choice.label === 'Even' ? 'E' : choice.label;
          return <Pressable
            accessibilityLabel={choice.label}
            accessibilityRole="button"
            disabled={!enabled}
            hitSlop={{ top: 5, bottom: 5, left: 2, right: 2 }}
            key={`rank-${choice.value}`}
            onPress={() => onPreview('rank', choice.value)}
            style={[styles.denseRankChoice, bounded && { height: envelope.choiceHeight, minWidth: envelope.choiceHeight }, { borderColor: selected ? theme.colors.accent : theme.colors.borderStrong }, !enabled && styles.choiceDisabled]}
          ><Text style={[styles.denseRankChoiceText, bounded && { includeFontPadding: false }, { color: theme.colors.text }]}>{label}</Text></Pressable>;
        })}</PaletteViewport>
      </View>
      <View style={[styles.denseActionRail, bounded && { width: Math.ceil(52 * Math.max(1, fontScale)), height: envelope.composerHeight }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close clue composer" hitSlop={{ top: 2, bottom: 2, left: 6, right: 6 }} onPress={onClear} style={({ pressed }) => [styles.denseActionButton, styles.denseCloseButton, bounded && { height: envelope.footerHeight, minHeight: envelope.footerHeight }, pressed && styles.denseActionPressed]}>
          <Text style={[styles.denseActionText, bounded && { lineHeight: 14, includeFontPadding: false }, { color: theme.colors.textMuted }]}>Close</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Give clue" disabled={!confirmAllowed || !validPreview} hitSlop={{ top: 2, bottom: 2, left: 6, right: 6 }} onPress={onConfirm} style={({ pressed }) => [styles.denseActionButton, bounded && { height: envelope.footerHeight, minHeight: envelope.footerHeight }, { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent }, !confirmAllowed || !validPreview ? styles.choiceDisabled : pressed && styles.denseActionPressed]}>
          <Text style={[styles.denseActionText, bounded && { lineHeight: 14, includeFontPadding: false }, { color: theme.colors.accentText }]}>Give</Text>
        </Pressable>
      </View>
    </View> : <>
    <View style={styles.header}>
      <Text numberOfLines={1} style={[styles.target, landscapePhone && styles.targetLandscape, { color: theme.colors.text }]}>{targetName}</Text>
      <ActionButton compact title="Close" tone="ghost" onPress={onClear} />
      <ActionButton compact disabled={!confirmAllowed || !validPreview} title="Give clue" tone="primary" onPress={onConfirm} />
    </View>

    <View style={styles.choiceGroups}>
      <View style={[styles.choiceRow, landscapePhone && styles.choiceRowLandscape]}>{choices?.colors.map((choice) => {
        const selected = previewState?.type === 'color' && previewState.value === choice.value;
        return <Pressable
          accessibilityLabel={choice.label}
          accessibilityRole="button"
          disabled={!enabled}
          key={`color-${choice.value}`}
          onPress={() => onPreview('color', choice.value)}
          style={[styles.colorChoice, { borderColor: selected ? theme.colors.accent : '#111111' }, !enabled && styles.choiceDisabled]}
        ><View style={[styles.colorSwatch, { backgroundColor: getClueColorFill(variantName, choice.value) ?? '#ffffff' }]} /></Pressable>;
      })}</View>
      <View style={[styles.choiceRow, landscapePhone && styles.choiceRowLandscape]}>{choices?.ranks.map((choice) => {
        const selected = previewState?.type === 'rank' && previewState.value === choice.value;
        const label = choice.label === 'Odd' ? 'O' : choice.label === 'Even' ? 'E' : choice.label;
        return <Pressable
          accessibilityLabel={choice.label}
          accessibilityRole="button"
          disabled={!enabled}
          key={`rank-${choice.value}`}
          onPress={() => onPreview('rank', choice.value)}
          style={[styles.rankChoice, { borderColor: selected ? theme.colors.accent : theme.colors.borderStrong }, !enabled && styles.choiceDisabled]}
        ><Text style={[styles.rankChoiceText, { color: theme.colors.text }]}>{label}</Text></Pressable>;
      })}</View>
    </View>
    </>}

  </View>;
}

const styles = StyleSheet.create({
  idleSurface: { alignItems: 'center', borderRadius: 10, borderWidth: 1, flexDirection: 'row', gap: 8, paddingHorizontal: 9, paddingVertical: 7 },
  idleSurfaceLandscape: { paddingHorizontal: 7, paddingVertical: 4 },
  idleText: { flex: 1, fontSize: 10, fontWeight: '700' },
  surface: { borderRadius: 10, borderWidth: 1, gap: 4, paddingHorizontal: 7, paddingVertical: 5 },
  denseSurface: { borderRadius: 0, borderWidth: 0, gap: 0, paddingHorizontal: 0, paddingVertical: 0 },
  surfaceLandscape: { gap: 3, paddingHorizontal: 6, paddingVertical: 4 },
  header: { alignItems: 'center', flexDirection: 'row', gap: 5 },
  eyebrow: { fontSize: 9, fontWeight: '900', letterSpacing: 0.9 },
  target: { fontSize: 14, fontWeight: '900' },
  targetLandscape: { fontSize: 12 },
  choiceGroups: { gap: 4 },
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  denseLayout: { alignItems: 'center', flexDirection: 'row', gap: 5 },
  densePalette: { flex: 1, gap: 2, minWidth: 0 },
  denseChoiceRow: { gap: 2 },
  denseActionRail: { alignItems: 'stretch', justifyContent: 'space-between', gap: 2 },
  denseActionButton: { alignItems: 'center', borderRadius: 7, borderWidth: 1, justifyContent: 'center', minHeight: 26, paddingHorizontal: 6, paddingVertical: 2 },
  denseCloseButton: { backgroundColor: 'transparent', borderColor: 'transparent' },
  denseActionText: { fontSize: 11, fontWeight: '700' },
  denseActionPressed: { opacity: 0.82 },
  choiceRowLandscape: { gap: 3 },
  colorChoice: { alignItems: 'center', backgroundColor: '#111111', borderRadius: 9, borderWidth: 2, height: 38, justifyContent: 'center', padding: 4, width: 38 },
  denseColorChoice: { alignItems: 'center', backgroundColor: '#111111', borderRadius: 7, borderWidth: 2, height: 26, justifyContent: 'center', padding: 3, width: 26 },
  colorSwatch: { borderRadius: 5, height: '100%', width: '100%' },
  rankChoice: { alignItems: 'center', borderRadius: 8, borderWidth: 2, height: 38, justifyContent: 'center', minWidth: 38, paddingHorizontal: 7 },
  denseRankChoice: { alignItems: 'center', borderRadius: 6, borderWidth: 2, height: 26, justifyContent: 'center', minWidth: 26, paddingHorizontal: 4 },
  rankChoiceText: { fontSize: 18, fontWeight: '900' },
  denseRankChoiceText: { fontSize: 16, fontWeight: '900', lineHeight: 18 },
  choiceDisabled: { opacity: 0.42 },
});
