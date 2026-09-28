import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from '@jest/globals';

const create = readFileSync(resolve(__dirname, 'CreateTableScreen.tsx'), 'utf8').replace(/\r\n/g, '\n');
const app = readFileSync(resolve(__dirname, '../../../App.tsx'), 'utf8').replace(/\r\n/g, '\n');
const editor = readFileSync(resolve(__dirname, '../TableOptionsEditor.tsx'), 'utf8').replace(/\r\n/g, '\n');

describe('Create Table task', () => {
  test('App owns one task, hides global navigation, and routes History seed prefill into it', () => {
    expect(app).toContain('const [createTaskOpen, setCreateTaskOpen] = useState(false);');
    expect(app).toContain('setSpecificSeedCreatePrefill(prefill);\n        navigate(\'home\');\n        setCreateTaskOpen(true);');
    expect(app).toContain('<CreateTableScreen onBack={closeCreateTask} backRef={createBackRef}');
    expect(app).toContain('!passwordTaskOpen && !createTaskOpen');
    expect(app).toContain("if (createTaskOpen && roomState.room.kind === 'none') {");
    expect(app).toContain('createBackRef.current?.();');
  });

  test('Back discards nested edits and root Back clears the password without creating', () => {
    expect(create).toContain("if (surface === 'root') closeTask();");
    expect(create).toContain("else if (surface === 'variant') setSurface('root');");
    expect(create).toContain("else if (surface === 'advanced') setSurface('root');");
    expect(create).toContain("else setSurface('advanced');");
    expect(create).toContain("const closeTask = () => { setTablePassword(''); onBack(); };");
    expect(create).toContain("const [tablePassword, setTablePassword] = useState('');");
    expect(create).toContain('useEffect(() => () => { if (backRef) backRef.current = null; }, [backRef]);');
    expect(create.slice(create.indexOf('const handleBack'), create.indexOf('const openNested'))).not.toContain('createTable(');
    expect(create).toContain('setNestedOptions(createOptions);');
    expect(create).toContain('setNestedBots(selectedBots);');
    expect(create).toContain('setNestedSeedSuffix(seedSuffix);');
    expect(create).toContain('setCreateOptions(nestedOptions);');
    expect(create).toContain('setSelectedBots(nestedBots);');
    expect(create).toContain('setSeedSuffix(nestedSeedSuffix);');
  });

  test('preserves server preferences, latent timers, name and create guards, and the exact runtime call', () => {
    expect(create).toContain('state.session.createTablePreferences');
    expect(create).toContain('useState(createPreferences.maxPlayers)');
    expect(create).toContain('variantName: preferences.variant');
    expect(create).toContain('timeBase: preferences.timed ? Math.round(preferences.timeBaseMinutes * 60) : 0');
    expect(create).toContain('timePerTurn: preferences.timed ? preferences.timePerTurnSeconds : 0');
    expect(create).toContain('timeBase: createOptions.timeBase, timePerTurn: createOptions.timePerTurn');
    expect(create).toContain('? { ...options, ...latentTimers.current }');
    expect(create).toContain('const MAX_PLAYER_OPTIONS = [2, 3, 4, 5, 6] as const;');
    expect(create).toContain('accessibilityState={{ selected }}');
    expect(create).toContain("const effectiveName = tableName.trim() || randomTableName?.trim() || '';");
    expect(create).toContain('effectiveName.length >= 1 && effectiveName.length <= 45');
    expect(create).toContain('disabled={!createAllowed || attendancePending || !createNameIsValid}');
    expect(create).toContain('getLobbySections(tables).showCreateTable');
    expect(create).toContain('lobbyRuntime.createTable(submittedName, maxPlayers, createOptions, tablePassword, selectedBots)');
    expect(create).toContain("setTablePassword('');\n            setSelectedBots([]);\n            onBack();");
  });

  test('uses the canonical seed name and keeps History reproduction guidance until edited', () => {
    expect(create).toContain('createSpecificSeedTableName(seedSuffix)');
    expect(create).toContain("const submittedName = useSpecificSeed ? specificSeedTableName ?? '' : tableName;");
    expect(create).toContain('setSeedSuffix(specificSeedCreatePrefill.seedSuffix);');
    expect(create).toContain('setMaxPlayers(specificSeedCreatePrefill.maxPlayers);');
    expect(create).toContain('setCreateOptions(specificSeedCreatePrefill.createOptions);');
    expect(create).toContain('setReproductionPlayerCount(specificSeedCreatePrefill.numPlayers);');
    expect(create).toContain('setNestedReproductionPlayerCount(null);');
    expect(create).toContain('setReproductionPlayerCount(null);');
    expect(create).toContain('To reproduce this deal, start with exactly {reproductionPlayerCount} players and keep this variant.');
  });

  test('reuses variant search, bot picker, and additional rule helper', () => {
    expect(create).toContain('<VariantPicker options={nestedOptions} onChange={setNestedOptions} />');
    expect(create).toContain('<BotPicker selected={nestedBots} onChange={setNestedBots} limit={maxPlayers - 1}');
    expect(create).toContain('protectedTable={tablePassword.length > 0}');
    expect(create).toContain('<RulePicker options={nestedOptions} onChange={setNestedOptions} />');
    expect(editor).toContain('SUPPORTED_VARIANT_NAMES.filter');
    expect(editor).toContain('toggleMobileTableBooleanOption(options, key)');
    expect(editor).toContain("['oneExtraCard', 'One Extra Card'], ['oneLessCard', 'One Less Card']");
  });
});
