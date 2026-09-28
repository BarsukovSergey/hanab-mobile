import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from '@jest/globals';

const source = readFileSync(join(__dirname, 'NoteEditor.tsx'), 'utf8');

describe('NoteEditor presentation autofocus', () => {
  it('waits for Modal onShow and remounts the editable Field when ready', () => {
    expect(source).toMatch(/onShow=\{\(\) => setPresentationReady\(true\)\}/);
    expect(source).toMatch(/const autofocusReady = editable && editing && presentationReady && focusOnShow;/);
    expect(source).toMatch(/autoFocus=\{autofocusReady\}/);
    expect(source).toMatch(/key=\{autofocusReady \? 'editing-ready' : editing \? 'editing-pending' : 'readonly'\}/);
  });

  it('resets presentation readiness when the editor closes', () => {
    expect(source).toMatch(/if \(!visible\)\s*\{\s*sessionOpen\.current = false;\s*setPresentationReady\(false\);/);
  });

  it('suspends the Modal without ending the transaction or refocusing on resume', () => {
    expect(source).toMatch(/if \(presentationVisible\) return;\s*setPresentationReady\(false\);\s*setFocusOnShow\(false\);/);
    expect(source).toContain('visible={visible && presentationVisible}');
    expect(source).toMatch(/const submitValue = \(nextValue: string\) => \{\s*if \(!visible \|\| !presentationVisible\) return;/);
    expect(source).toMatch(/const cancelAndClose = \(\) => \{\s*if \(!presentationVisible\) return;/);
    expect(source).toContain('setFocusOnShow(shouldEdit && presentationVisible)');
    expect(source).toMatch(/const autofocusReady = editable && editing && presentationReady && focusOnShow;/);
    const suspension = source.match(/useEffect\(\(\) => \{\s*if \(presentationVisible\) return;[\s\S]*?\}, \[presentationVisible\]\);/)?.[0] ?? '';
    expect(suspension).not.toMatch(/setDraft|sessionSavedValue|onSave|onClose|sessionOpen/);
  });
});
