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
  expect(settings).toContain('value={presentation.colorblindMode}');
  expect(settings).toContain('value={presentation.styleNumbers}');
  expect(settings).toContain('accessibilityRole="switch"');
  expect(settings).not.toContain('disabled={presentation.colorblindMode}');
});
