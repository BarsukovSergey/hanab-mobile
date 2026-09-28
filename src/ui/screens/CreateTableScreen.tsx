import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { pruneBotSelection } from '../../config/knownBots';
import type { CreateTablePreferences, MobileTableOptions } from '../../protocol/lobbyProtocol';
import { lobbyRuntime } from '../../runtime/application';
import { useAppSelector } from '../../store/hooks';
import { tableSelectors, userSelectors } from '../../store/store';
import { BotPicker } from '../BotPicker';
import { ActionButton, Field, Panel, SectionHeading, useHanabTheme, useResponsiveLayout } from '../designSystem';
import { getLobbySections } from '../lobbySections';
import { createSpecificSeedTableName } from '../specificSeedName';
import { RulePicker, VariantPicker } from '../TableOptionsEditor';
import { toggleMobileTableBooleanOption } from '../tableOptions';
import { measureSurface } from '../responsiveSurface';

export type SpecificSeedCreatePrefill = {
  seedSuffix: string;
  maxPlayers: number;
  numPlayers: number;
  createOptions: MobileTableOptions;
};

type CreateSurface = 'root' | 'variant' | 'advanced' | 'bots' | 'specific-seed' | 'additional-rules';
const MAX_PLAYER_OPTIONS = [2, 3, 4, 5, 6] as const;

function createOptionsFromPreferences(preferences: CreateTablePreferences): MobileTableOptions {
  return {
    variantName: preferences.variant,
    timed: preferences.timed,
    timeBase: preferences.timed ? Math.round(preferences.timeBaseMinutes * 60) : 0,
    timePerTurn: preferences.timed ? preferences.timePerTurnSeconds : 0,
    cardCycle: preferences.cardCycle, emptyClues: preferences.emptyClues,
    oneExtraCard: preferences.oneExtraCard, oneLessCard: preferences.oneLessCard,
    allOrNothing: preferences.allOrNothing,
  };
}

export function CreateTableScreen({ onBack, backRef, specificSeedCreatePrefill = null }: {
  onBack: () => void;
  backRef?: { current: (() => void) | null };
  specificSeedCreatePrefill?: SpecificSeedCreatePrefill | null;
}) {
  const { theme } = useHanabTheme();
  const responsiveWindow = useResponsiveLayout();
  const taskGeometry = measureSurface(responsiveWindow, 'task');
  const createPreferences = useAppSelector((state) => state.session.createTablePreferences);
  const sessionReady = useAppSelector((state) => state.session.phase === 'ready');
  const randomTableName = useAppSelector((state) => state.session.randomTableName);
  const roomState = useAppSelector((state) => state.room);
  const tables = useAppSelector(tableSelectors.selectAll);
  const users = useAppSelector(userSelectors.selectAll);
  const [surface, setSurface] = useState<CreateSurface>('root');
  const [tableName, setTableName] = useState('');
  const [tablePassword, setTablePassword] = useState('');
  const [useSpecificSeed, setUseSpecificSeed] = useState(false);
  const [seedSuffix, setSeedSuffix] = useState('');
  const [reproductionPlayerCount, setReproductionPlayerCount] = useState<number | null>(null);
  const [selectedBots, setSelectedBots] = useState<string[]>([]);
  const [maxPlayers, setMaxPlayers] = useState(createPreferences.maxPlayers);
  const [createOptions, setCreateOptions] = useState<MobileTableOptions>(() => createOptionsFromPreferences(createPreferences));
  const [nestedOptions, setNestedOptions] = useState(createOptions);
  const [nestedBots, setNestedBots] = useState<string[]>([]);
  const [nestedSeedSuffix, setNestedSeedSuffix] = useState('');
  const [nestedUseSpecificSeed, setNestedUseSpecificSeed] = useState(false);
  const [nestedReproductionPlayerCount, setNestedReproductionPlayerCount] = useState<number | null>(null);
  const latentTimers = useRef({
    timeBase: Math.round(createPreferences.timeBaseMinutes * 60),
    timePerTurn: createPreferences.timePerTurnSeconds,
  });
  const preferencesInitialized = useRef(false);

  useEffect(() => {
    if (!sessionReady || preferencesInitialized.current) return;
    preferencesInitialized.current = true;
    if (specificSeedCreatePrefill !== null) return;
    setMaxPlayers(createPreferences.maxPlayers);
    setCreateOptions(createOptionsFromPreferences(createPreferences));
    latentTimers.current = {
      timeBase: Math.round(createPreferences.timeBaseMinutes * 60),
      timePerTurn: createPreferences.timePerTurnSeconds,
    };
  }, [createPreferences, sessionReady, specificSeedCreatePrefill]);
  useEffect(() => {
    if (specificSeedCreatePrefill === null) return;
    setUseSpecificSeed(true);
    setSeedSuffix(specificSeedCreatePrefill.seedSuffix);
    setMaxPlayers(specificSeedCreatePrefill.maxPlayers);
    setCreateOptions(specificSeedCreatePrefill.createOptions);
    if (specificSeedCreatePrefill.createOptions.timed) latentTimers.current = {
      timeBase: specificSeedCreatePrefill.createOptions.timeBase,
      timePerTurn: specificSeedCreatePrefill.createOptions.timePerTurn,
    };
    setReproductionPlayerCount(specificSeedCreatePrefill.numPlayers);
  }, [specificSeedCreatePrefill]);
  useEffect(() => {
    setSelectedBots((current) => {
      const next = pruneBotSelection(current, users, [], tablePassword.length > 0, maxPlayers - 1);
      return next.length === current.length && next.every((name, index) => name === current[index]) ? current : next;
    });
  }, [users, tablePassword, maxPlayers]);
  useEffect(() => () => { if (backRef) backRef.current = null; }, [backRef]);

  const closeTask = () => { setTablePassword(''); onBack(); };
  const handleBack = () => {
    if (surface === 'root') closeTask();
    else if (surface === 'variant') setSurface('root');
    else if (surface === 'advanced') setSurface('root');
    else setSurface('advanced');
  };
  if (backRef) backRef.current = handleBack;

  const openNested = (next: CreateSurface) => {
    setNestedOptions(createOptions);
    setNestedBots(selectedBots);
    setNestedSeedSuffix(seedSuffix);
    setNestedUseSpecificSeed(useSpecificSeed);
    setNestedReproductionPlayerCount(reproductionPlayerCount);
    setSurface(next);
  };
  const applyNested = () => {
    if (surface === 'variant' || surface === 'additional-rules') {
      setCreateOptions(nestedOptions);
      if (nestedOptions !== createOptions) setReproductionPlayerCount(null);
    }
    if (surface === 'bots') setSelectedBots(nestedBots);
    if (surface === 'specific-seed') {
      setUseSpecificSeed(nestedUseSpecificSeed);
      setSeedSuffix(nestedSeedSuffix);
      setReproductionPlayerCount(nestedReproductionPlayerCount);
    }
    setSurface(surface === 'variant' ? 'root' : 'advanced');
  };
  const updateOptions = (options: MobileTableOptions) => {
    if (createOptions.timed && !options.timed) latentTimers.current = {
      timeBase: createOptions.timeBase, timePerTurn: createOptions.timePerTurn,
    };
    const nextOptions = !createOptions.timed && options.timed
      ? { ...options, ...latentTimers.current }
      : options;
    if (nextOptions.timed) latentTimers.current = {
      timeBase: nextOptions.timeBase, timePerTurn: nextOptions.timePerTurn,
    };
    setCreateOptions(nextOptions);
    setReproductionPlayerCount(null);
  };
  const effectiveName = tableName.trim() || randomTableName?.trim() || '';
  const specificSeedTableName = createSpecificSeedTableName(seedSuffix);
  const submittedName = useSpecificSeed ? specificSeedTableName ?? '' : tableName;
  const createNameIsValid = useSpecificSeed
    ? specificSeedTableName !== null
    : effectiveName.length >= 1 && effectiveName.length <= 45;
  const attendancePending = roomState.pendingSpectateTableID !== null
    || roomState.pendingRecovery !== null
    || roomState.pendingJoin !== null
    || roomState.pendingCreate !== null;
  const createAllowed = getLobbySections(tables).showCreateTable;

  return <View style={[styles.root, { maxWidth: taskGeometry.contentWidth }]}>
    <View style={styles.header}>
      <ActionButton compact title="Back" onPress={handleBack} />
      <Text style={[styles.title, { color: theme.colors.text }]}>{surface === 'root' ? 'Create Table' : surface === 'specific-seed' ? 'Specific seed' : surface === 'additional-rules' ? 'Additional rules' : surface.charAt(0).toUpperCase() + surface.slice(1)}</Text>
    </View>
    {surface === 'root' && <Panel style={styles.panel}>
      <SectionHeading title="Variant" detail={createOptions.variantName} />
      <ActionButton title="Choose variant" onPress={() => openNested('variant')} />
      <Text style={[styles.label, { color: theme.colors.textMuted }]}>Max players</Text>
      <View style={styles.playerOptions}>{MAX_PLAYER_OPTIONS.map((value) => {
        const selected = maxPlayers === value;
        return <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected }} hitSlop={6}
          onPress={() => { setMaxPlayers(value); setReproductionPlayerCount(null); setSelectedBots((names) => names.slice(0, value - 1)); }}
          style={[styles.playerOption, { backgroundColor: selected ? theme.colors.accent : theme.colors.surfaceRaised,
            borderColor: selected ? theme.colors.accent : theme.colors.borderStrong }]}>
          <Text style={[styles.playerOptionText, { color: selected ? theme.colors.accentText : theme.colors.text }]}>{value}</Text>
        </Pressable>;
      })}</View>
      <ActionButton title={createOptions.timed ? 'Timed: On' : 'Timed: Off'}
        onPress={() => updateOptions(toggleMobileTableBooleanOption(createOptions, 'timed'))} />
      {createOptions.timed && <View style={styles.timerRow}>
        <View style={styles.timerField}><Text style={{ color: theme.colors.textMuted }}>Base time (seconds)</Text>
          <Field keyboardType="number-pad" onChangeText={(value) => updateOptions({ ...createOptions, timeBase: Number(value) })} value={String(createOptions.timeBase)} /></View>
        <View style={styles.timerField}><Text style={{ color: theme.colors.textMuted }}>Per turn (seconds)</Text>
          <Field keyboardType="number-pad" onChangeText={(value) => updateOptions({ ...createOptions, timePerTurn: Number(value) })} value={String(createOptions.timePerTurn)} /></View>
      </View>}
      <SectionHeading title="Table name / access" detail={useSpecificSeed ? `Specific seed: ${seedSuffix}` : 'Blank name uses the server suggestion.'} />
      {useSpecificSeed ? <Text style={{ color: theme.colors.textMuted }}>This table uses the specific seed selected in Advanced.</Text>
        : <Field maxLength={45} onChangeText={setTableName} placeholder={randomTableName ?? 'Table name'} value={tableName} />}
      {useSpecificSeed && reproductionPlayerCount !== null && <Text style={{ color: theme.colors.textMuted }}>
        To reproduce this deal, start with exactly {reproductionPlayerCount} players and keep this variant.
      </Text>}
      <Field autoCapitalize="none" autoCorrect={false} onChangeText={setTablePassword}
        placeholder="Table password (optional)" secureTextEntry value={tablePassword} />
      <SectionHeading title="Advanced" detail={`${selectedBots.length} bots · ${useSpecificSeed ? 'Specific seed' : 'Random deal'}`} />
      <ActionButton title="Advanced options" onPress={() => setSurface('advanced')} />
      <ActionButton disabled={!createAllowed || attendancePending || !createNameIsValid}
        title={roomState.pendingCreate === null ? 'Create Table' : 'Creating…'} tone="primary"
        onPress={() => {
          if (lobbyRuntime.createTable(submittedName, maxPlayers, createOptions, tablePassword, selectedBots)) {
            setTablePassword('');
            setSelectedBots([]);
          }
        }} />
    </Panel>}
    {surface === 'advanced' && <Panel style={styles.panel}>
      <SectionHeading title="Advanced" detail="Choose optional table settings." />
      <ActionButton title={`Bots (${selectedBots.length})`} onPress={() => openNested('bots')} />
      <ActionButton title={useSpecificSeed ? `Specific seed: ${seedSuffix}` : 'Specific seed'} onPress={() => openNested('specific-seed')} />
      <ActionButton title="Additional rules" onPress={() => openNested('additional-rules')} />
    </Panel>}
    {surface === 'variant' && <Panel style={styles.panel}>
      <SectionHeading title="Variant" detail={nestedOptions.variantName} />
      <VariantPicker options={nestedOptions} onChange={setNestedOptions} />
      <ActionButton title="Apply" tone="primary" onPress={applyNested} />
      <ActionButton title="Cancel" tone="ghost" onPress={handleBack} />
    </Panel>}
    {surface === 'bots' && <Panel style={styles.panel}>
      <SectionHeading title="Bots" detail="Invite bots after creating the table." />
      <BotPicker selected={nestedBots} onChange={setNestedBots} limit={maxPlayers - 1}
        users={users} protectedTable={tablePassword.length > 0} />
      <ActionButton title="Apply" tone="primary" onPress={applyNested} />
      <ActionButton title="Cancel" tone="ghost" onPress={handleBack} />
    </Panel>}
    {surface === 'specific-seed' && <Panel style={styles.panel}>
      <SectionHeading title="Specific seed" detail="Choose an exact deal suffix." />
      <ActionButton title={nestedUseSpecificSeed ? 'Use specific seed: On' : 'Use specific seed'}
        onPress={() => { if (nestedUseSpecificSeed) setNestedReproductionPlayerCount(null); setNestedUseSpecificSeed(!nestedUseSpecificSeed); }} />
      {nestedUseSpecificSeed && <>
        <Field autoCapitalize="none" autoCorrect={false} spellCheck={false}
          onChangeText={(value) => { setNestedSeedSuffix(value); setNestedReproductionPlayerCount(null); }}
          placeholder="Seed suffix" value={nestedSeedSuffix} />
        <Text style={{ color: theme.colors.textMuted }}>hanab.live combines this suffix with the actual player count and variant when the game starts.</Text>
        {nestedReproductionPlayerCount !== null && <Text style={{ color: theme.colors.textMuted }}>
          To reproduce this deal, start with exactly {nestedReproductionPlayerCount} players and keep this variant.
        </Text>}
      </>}
      <ActionButton disabled={nestedUseSpecificSeed && createSpecificSeedTableName(nestedSeedSuffix) === null}
        title="Apply" tone="primary" onPress={applyNested} />
      <ActionButton title="Cancel" tone="ghost" onPress={handleBack} />
    </Panel>}
    {surface === 'additional-rules' && <Panel style={styles.panel}>
      <SectionHeading title="Additional rules" />
      <RulePicker options={nestedOptions} onChange={setNestedOptions} />
      <ActionButton title="Apply" tone="primary" onPress={applyNested} />
      <ActionButton title="Cancel" tone="ghost" onPress={handleBack} />
    </Panel>}
  </View>;
}

const styles = StyleSheet.create({
  root: { alignSelf: 'center', gap: 16, width: '100%' },
  header: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  title: { flex: 1, fontSize: 22, fontWeight: '800' },
  panel: { gap: 12 },
  label: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  playerOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  playerOption: { alignItems: 'center', borderRadius: 10, borderWidth: 1, justifyContent: 'center', minHeight: 44, minWidth: 44, paddingHorizontal: 12 },
  playerOptionText: { fontSize: 15, fontWeight: '800' },
  timerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  timerField: { flex: 1, gap: 5, minWidth: 150 },
});
