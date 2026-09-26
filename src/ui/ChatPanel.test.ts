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

describe('table chat read contract', () => {
  test('reads table chat on room/message transitions and never sends for lobby', () => {
    const source = readFileSync(join(__dirname, 'ChatPanel.tsx'), 'utf8');
    const effect = source.match(/useEffect\(\(\) => \{\s*dispatch\(chatActions\.roomRead\([\s\S]*?\n  \}, \[dispatch, messages\.length, ready, room\]\);/)?.[0] ?? '';
    expect(effect).toMatch(/lobbyRuntime\.markChatRead\(room\)/);
    expect(effect).toMatch(/\^table\[1-9\]/);
    expect(effect).toMatch(/\[dispatch, messages\.length, ready, room\]/);
    expect(effect).not.toMatch(/render/);
  });
});
