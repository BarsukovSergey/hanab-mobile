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
    const effect = source.match(/useEffect\(\(\) => \{\s*if \(!readActive \|\| !appActive \|\| !ready \|\| !atEnd\) return;\s*dispatch\(chatActions\.roomRead\([\s\S]*?\n  \}, \[appActive, atEnd, dispatch, messages, readActive, ready, room\]\);/)?.[0] ?? '';
    expect(source).toContain("useState(AppState.currentState === 'active')");
    expect(source).toContain("AppState.addEventListener('change', (state) => setAppActive(state === 'active'))");
    expect(source).toContain('readActive = true');
    expect(source).toMatch(/if \(!readActive \|\| !appActive \|\| !ready \|\| !atEnd\) return;\s*historyRef\.current\?\.scrollToEnd/);
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


test('history reading gates follow and read; New waits for the scroll boundary', () => {
  const source = readFileSync(join(__dirname, 'ChatPanel.tsx'), 'utf8');
  const contentChange = source.slice(source.indexOf('onContentSizeChange='), source.indexOf('onScroll='));
  expect(contentChange).toContain('if (!readActive || !appActive || !ready) return;');
  expect(contentChange).toContain('if (followEnd.current) historyRef.current?.scrollToEnd');
  const scroll = source.slice(source.indexOf('onScroll='), source.indexOf('nestedScrollEnabled'));
  expect(scroll).toContain('if (!readActive || !appActive || !ready) return;');
  expect(scroll).toContain('setAtEnd(end)');
  expect(scroll).toContain('if (end) setNewMessages(false)');
  const jump = source.slice(source.indexOf('{newMessages && !atEnd'), source.indexOf('      <Field'));
  expect(jump).toContain('scrollToEnd');
  expect(jump).not.toMatch(/roomRead|markChatRead/);
  expect(source).toContain('latestMessage !== previousLatestMessage.current');
  expect(source).toContain('historyRef.current?.scrollTo({ y: historyOffset.current, animated: false })');
});

test('local IME avoidance belongs only to the fill Chat task', () => {
  const source = readFileSync(join(__dirname, 'ChatPanel.tsx'), 'utf8');
  expect(source).toContain('fill ? [styles.fill, { paddingBottom: Math.max(0, imeOcclusion - systemInsets.bottom) }]');
  expect(source).toContain('fillHistory: { flex: 1, minHeight: 0, maxHeight: undefined }');
});
