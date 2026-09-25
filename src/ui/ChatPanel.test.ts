import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from '@jest/globals';

describe('chat composer keyboard submission', () => {
  test('uses an explicit send key and submit behavior for the multiline input', () => {
    const source = readFileSync(join(__dirname, 'ChatPanel.tsx'), 'utf8');
    const input = source.match(/<Field([\s\S]*?)\/>/)?.[1] ?? '';

    expect(input).toMatch(/multiline\b/);
    expect(input).toMatch(/returnKeyType="send"/);
    expect(input).toMatch(/submitBehavior="submit"/);
    expect(input).toMatch(/onSubmitEditing=\{send\}/);
    expect(source).toMatch(/onPress=\{send\}/);
    expect(input).not.toMatch(/submitBehavior="newline"/);
  });
});
