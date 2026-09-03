import { useState } from 'react';
import { Button, Text, TextInput, View } from 'react-native';

import { SUPPORTED_VARIANT_NAMES } from '../game/client/supportedVariants';
import type { MobileTableOptions } from '../protocol/lobbyProtocol';
import { toggleMobileTableBooleanOption, type BooleanMobileTableOption } from './tableOptions';
import { shellStyles } from './shellStyles';

export function TableOptionsEditor({ options, onChange }: {
  options: MobileTableOptions;
  onChange: (options: MobileTableOptions) => void;
}) {
  const [variantSearch, setVariantSearch] = useState('');
  const matchingVariants = SUPPORTED_VARIANT_NAMES.filter((name) => (
    name.toLocaleLowerCase().includes(variantSearch.trim().toLocaleLowerCase())
  )).slice(0, 20);
  const toggle = (key: BooleanMobileTableOption) => {
    onChange(toggleMobileTableBooleanOption(options, key));
  };
  return (
    <View style={shellStyles.subsection}>
      <Text>Variant</Text>
      <TextInput autoCapitalize="none" onChangeText={setVariantSearch}
        placeholder="Search variants" value={variantSearch} />
      {matchingVariants.map((name) => (
        <Button key={name} title={`${options.variantName === name ? '✓ ' : ''}${name}`}
          onPress={() => onChange({ ...options, variantName: name })} />
      ))}
      {([
        ['timed', 'Timed'], ['cardCycle', 'Card Cycle'], ['emptyClues', 'Empty Clues'],
        ['oneExtraCard', 'One Extra Card'], ['oneLessCard', 'One Less Card'],
        ['allOrNothing', 'All or Nothing'],
      ] as const).map(([key, label]) => (
        <Button key={key} title={`${options[key] ? '✓ ' : ''}${label}`}
          onPress={() => toggle(key)} />
      ))}
      {options.timed && (<>
        <Text>Base Time (seconds)</Text>
        <TextInput keyboardType="number-pad" onChangeText={(value) => onChange({
          ...options, timeBase: Number(value),
        })} style={shellStyles.input} value={String(options.timeBase)} />
        <Text>Per Turn (seconds)</Text>
        <TextInput keyboardType="number-pad" onChangeText={(value) => onChange({
          ...options, timePerTurn: Number(value),
        })} style={shellStyles.input} value={String(options.timePerTurn)} />
      </>)}
    </View>
  );
}
