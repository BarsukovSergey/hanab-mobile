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
  expect(settings.indexOf('<ActionButton compact title="Back"')).toBeLessThan(settings.indexOf('>Settings</Text>'));
  expect(settings).not.toContain('App preferences.');
  expect(settings).not.toContain('<SectionHeading title="Settings"');
});

test('live-game identity contains only the authenticated username with single-line truncation', () => {
  const app = read('App.tsx');
  const identity = app.slice(app.indexOf('{!landscapePhone && <View style={styles.brandCopy}'), app.indexOf('<View style={[styles.headerActions', app.indexOf('{!landscapePhone && <View style={styles.brandCopy}')));
  expect(identity).toContain('session.authenticatedUser?.username');
  expect(identity).toContain('numberOfLines={1}');
  expect(identity).toContain('ellipsizeMode="tail"');
  expect(identity).not.toContain('Hanab');
  expect(identity).not.toContain('authName');
});
