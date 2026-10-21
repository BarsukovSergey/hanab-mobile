import { expect, test } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), ...relativePath.split('/')), 'utf8');
}

test('production gameplay screens keep live and replay hands free of horizontal ScrollView surfaces', () => {
  const wrapper = read('src/ui/game/GameScreen.tsx');
  const c17 = read('src/ui/game/C17GameScreen.tsx');
  const source = [wrapper, c17].join('\n');

  expect(source).not.toMatch(/<ScrollView\b[^>]*\bhorizontal(?:\s|=|>)/s);
  expect(wrapper).not.toContain('LegacyGameScreen');
});
