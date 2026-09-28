import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { SUPPORTED_VARIANT_NAMES } from '../game/client/supportedVariants';
import type { MobileTableOptions } from '../protocol/lobbyProtocol';
import {
  Field,
  SectionHeading,
  useHanabTheme,
} from './designSystem';
import { toggleMobileTableBooleanOption, type BooleanMobileTableOption } from './tableOptions';

export function TableOptionsEditor({ options, onChange }: {
  options: MobileTableOptions;
  onChange: (options: MobileTableOptions) => void;
}) {
  const { theme } = useHanabTheme();

  return (
    <View style={[styles.root, { borderColor: theme.colors.border }]}>
      <SectionHeading title="Variant & rules" detail={`Selected: ${options.variantName}`} />
      <VariantPicker options={options} onChange={onChange} />
      <Text style={[styles.label, { color: theme.colors.textMuted }]}>Optional rules</Text>
      <RulePicker options={options} onChange={onChange} includeTimed />
      {options.timed && (
        <View style={styles.timedRow}>
          <View style={styles.timedField}>
            <Text style={[styles.label, { color: theme.colors.textMuted }]}>Base time (seconds)</Text>
            <Field keyboardType="number-pad" onChangeText={(value) => onChange({
              ...options, timeBase: Number(value),
            })} value={String(options.timeBase)} />
          </View>
          <View style={styles.timedField}>
            <Text style={[styles.label, { color: theme.colors.textMuted }]}>Per turn (seconds)</Text>
            <Field keyboardType="number-pad" onChangeText={(value) => onChange({
              ...options, timePerTurn: Number(value),
            })} value={String(options.timePerTurn)} />
          </View>
        </View>
      )}
    </View>
  );
}

type PickerProps = { options: MobileTableOptions; onChange: (options: MobileTableOptions) => void };

export function VariantPicker({ options, onChange }: PickerProps) {
  const { theme } = useHanabTheme();
  const [variantSearch, setVariantSearch] = useState('');
  const matchingVariants = SUPPORTED_VARIANT_NAMES.filter((name) => (
    name.toLocaleLowerCase().includes(variantSearch.trim().toLocaleLowerCase())
  )).slice(0, 20);
  return <>
    <Field autoCapitalize="none" autoCorrect={false} onChangeText={setVariantSearch}
      placeholder="Search variants" value={variantSearch} />
    <View style={styles.chips}>{matchingVariants.map((name) => {
      const active = options.variantName === name;
      return <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} key={name}
        onPress={() => onChange({ ...options, variantName: name })}
        style={({ pressed }) => [styles.chip, {
          backgroundColor: active ? theme.colors.accent : theme.colors.surfaceRaised,
          borderColor: active ? theme.colors.accent : theme.colors.border,
        }, pressed && { opacity: 0.72 }]}>
        <Text style={[styles.chipText, { color: active ? theme.colors.accentText : theme.colors.text }]}>
          {active ? '✓ ' : ''}{name}
        </Text>
      </Pressable>;
    })}</View>
  </>;
}

export function RulePicker({ options, onChange, includeTimed = false }: PickerProps & { includeTimed?: boolean }) {
  const { theme } = useHanabTheme();
  const toggles: readonly (readonly [BooleanMobileTableOption, string])[] = [
    ...(includeTimed ? [['timed', 'Timed'] as const] : []),
    ['cardCycle', 'Card Cycle'], ['emptyClues', 'Empty Clues'],
    ['oneExtraCard', 'One Extra Card'], ['oneLessCard', 'One Less Card'],
    ['allOrNothing', 'All or Nothing'],
  ];
  return <View style={styles.chips}>{toggles.map(([key, label]) => {
    const active = options[key];
    return <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: active }} key={key}
      onPress={() => onChange(toggleMobileTableBooleanOption(options, key))}
      style={({ pressed }) => [styles.chip, {
        backgroundColor: active ? theme.colors.accent : theme.colors.surfaceRaised,
        borderColor: active ? theme.colors.accent : theme.colors.border,
      }, pressed && { opacity: 0.72 }]}>
      <Text style={[styles.chipText, { color: active ? theme.colors.accentText : theme.colors.text }]}>
        {active ? '✓ ' : ''}{label}
      </Text>
    </Pressable>;
  })}</View>;
}

const styles = StyleSheet.create({
  root: { borderTopWidth: 1, gap: 10, paddingTop: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: { borderRadius: 999, borderWidth: 1, minHeight: 36, justifyContent: 'center', paddingHorizontal: 11, paddingVertical: 7 },
  chipText: { fontSize: 13, fontWeight: '700' },
  label: { fontSize: 11, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase' },
  timedRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  timedField: { flex: 1, gap: 5, minWidth: 150 },
});
