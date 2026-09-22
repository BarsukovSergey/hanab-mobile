import { expect, test } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';

test('GameScreen keeps live and replay hands free of horizontal ScrollView surfaces', () => {
  const source = fs.readFileSync(path.join(process.cwd(), 'src', 'ui', 'game', 'GameScreen.tsx'), 'utf8');

  expect(source).not.toMatch(/\bScrollView\b/);
  expect(source).toContain('flexWrap: \'wrap\'');
  expect(source).toContain('replayHand');
});
