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
  test('reads only when presented, foreground, and session ready', () => {
    const source = readFileSync(join(__dirname, 'ChatPanel.tsx'), 'utf8');
    const effect = source.match(/useEffect\(\(\) => \{\s*if \(!readActive \|\| !appActive \|\| !ready\) return;\s*dispatch\(chatActions\.roomRead\([\s\S]*?\n  \}, \[appActive, dispatch, messages\.length, readActive, ready, room\]\);/)?.[0] ?? '';
    expect(source).toContain("useState(AppState.currentState === 'active')");
    expect(source).toContain("AppState.addEventListener('change', (state) => setAppActive(state === 'active'))");
    expect(source).toContain('readActive = true');
    expect(source).toMatch(/if \(!readActive \|\| !appActive \|\| !ready\) return;\s*historyRef\.current\?\.scrollToEnd/);
    expect(effect).toMatch(/dispatch\(chatActions\.roomRead\(\{ room \}\)\)/);
    expect(effect).toMatch(/lobbyRuntime\.markChatRead\(room\)/);
    expect(effect).toMatch(/\^table\[1-9\]/);
    expect(effect).not.toMatch(/render/);
  });

  test('requires session readiness, send permission, and a nonempty draft before submission', () => {
    const source = readFileSync(join(__dirname, 'ChatPanel.tsx'), 'utf8');
    expect(source).toContain('sendEnabled?: boolean;');
    expect(source).toContain('sendEnabled = true');
    expect(source).toContain('const canSend = ready && sendEnabled && trimmed.length > 0;');
    expect(source).toMatch(/const send = \(\) => \{\s*if \(!canSend\) return;\s*dispatch\(chatActions\.draftSubmissionFinished\(\{\s*room,\s*succeeded: chatRuntime\.submit\(draft\)/);
    expect(source).toContain('editable={ready && sendEnabled}');
    expect(source).toContain('disabled={!canSend} title="Send"');
  });
});
