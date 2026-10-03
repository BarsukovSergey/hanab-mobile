import { expect, test } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, ...relativePath.split('/')), 'utf8');
}

test('the Settings screen used by App owns the dev-only gameplay scenario entry', () => {
  const app = read('App.tsx');
  const settings = read('src/ui/screens/SettingsScreen.tsx');

  expect(app).toContain("from './src/ui/screens/SettingsScreen'");
  expect(settings).toContain('GameplayScenarioGallery');
  expect(settings).toContain('__DEV__');
  expect(fs.existsSync(path.join(root, 'src', 'ui', 'secondary', 'SettingsScreen.tsx'))).toBe(false);
});

test('card appearance toggles use Redux values and the typed lobby runtime setter', () => {
  const settings = read('src/ui/screens/SettingsScreen.tsx');

  expect(settings).toContain('state.session.cardPresentationSettings');
  expect(settings).toContain("lobbyRuntime.setCardPresentationSetting('colorblindMode', enabled)");
  expect(settings).toContain("lobbyRuntime.setCardPresentationSetting('styleNumbers', enabled)");
  expect(settings).toContain("lobbyRuntime.setCardPresentationSetting('reverseHands', enabled)");
  expect(settings).toContain('value={presentation.colorblindMode}');
  expect(settings).toContain('value={presentation.styleNumbers}');
  expect(settings).toContain('value={presentation.reverseHands}');
  expect(settings).toContain('accessibilityRole="switch"');
  expect(settings).not.toContain('disabled={presentation.colorblindMode}');
});

test('untimed timer switch uses the Redux setting and typed gameplay setter', () => {
  const settings = read('src/ui/screens/SettingsScreen.tsx');
  expect(settings).toContain('state.session.showTimerInUntimed');
  expect(settings).toContain('Show turn timers in untimed games');
  expect(settings).toContain("lobbyRuntime.setGameplayPresentationSetting('showTimerInUntimed', enabled)");
  expect(settings).toContain('value={showTimerInUntimed}');
});

test('sign out is confirmed from Settings and both App entry paths use App signOut', () => {
  const app = read('App.tsx');
  const settings = read('src/ui/screens/SettingsScreen.tsx');
  expect(app.split('onSignOut={() => void signOut()}').length - 1).toBe(2);
  expect(app).not.toContain('<ActionButton compact title="Sign out"');
  expect(app).not.toContain('<ActionButton title="Sign out"');
  expect(settings).toContain('<ActionButton title="Sign out" tone="danger" onPress={confirmSignOut} />');
  expect(settings).toContain("Alert.alert('Sign out?', `Are you sure you want to sign out of ${authenticatedUsername}?`");
  expect(settings).toContain("{ text: 'Cancel', style: 'cancel' }");
  expect(settings).toContain("{ text: 'Sign out', style: 'destructive', onPress: onSignOut }");
  expect(settings).toContain('{ cancelable: false }');
});

test('Settings uses a local Back then title navigation header', () => {
  const settings = read('src/ui/screens/SettingsScreen.tsx');
  expect(settings.indexOf('<ActionButton compact title="Back"')).toBeLessThan(settings.indexOf("category === null ? 'Settings'"));
  expect(settings).toContain("if (changePasswordOpen) {");
  expect(settings).toContain('clearPasswordFields();');
  expect(settings).toContain('backRef.current = handleBack');
  expect(settings).not.toContain('App preferences.');
  expect(settings).not.toContain('<SectionHeading title="Settings"');
});

test('Settings groups existing controls under the four canonical categories', () => {
  const settings = read('src/ui/screens/SettingsScreen.tsx');
  for (const title of ['Account & security', 'Appearance', 'Cards', 'Gameplay presentation']) {
    expect(settings).toContain('title="' + title + '"');
  }
  expect(settings).toContain("category === 'account'");
  expect(settings).toContain("category === 'cards'");
  expect(settings).toContain("category === 'gameplay'");
});

test('portrait Live identity is always the current variant with single-line truncation', () => {
  const app = read('App.tsx');
  const start = app.indexOf('{width <= height && <Text');
  const identity = app.slice(start, app.indexOf('</Text>}', start));
  expect(identity).toContain('liveClientState.metadata.options.variantName');
  expect(identity).toContain('numberOfLines={1}');
  expect(identity).toContain('ellipsizeMode="tail"');
  expect(identity).not.toContain('username');
  expect(identity).not.toContain('tableID');
});


test('Own hand position is a local Redux preference with Top and Bottom choices', () => {
  const settings = read('src/ui/screens/SettingsScreen.tsx');
  expect(settings).toContain('state.presentationPreferences.ownHandPosition');
  expect(settings).toContain('Own hand position');
  expect(settings).toContain("(['top', 'bottom'] as const)");
  expect(settings).toContain("position === 'top' ? 'Top' : 'Bottom'");
  expect(settings).toContain('dispatch(presentationPreferencesActions.ownHandPositionChanged(position))');
  expect(settings).not.toContain('keldonMode');
});
