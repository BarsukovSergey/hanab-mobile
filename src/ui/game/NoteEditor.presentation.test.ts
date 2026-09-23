import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from '@jest/globals';

const source = readFileSync(join(__dirname, 'NoteEditor.tsx'), 'utf8');

describe('NoteEditor presentation autofocus', () => {
  it('waits for Modal onShow and remounts the editable Field when ready', () => {
    expect(source).toMatch(/onShow=\{\(\) => setPresentationReady\(true\)\}/);
    expect(source).toMatch(/const autofocusReady = editable && editing && presentationReady;/);
    expect(source).toMatch(/autoFocus=\{autofocusReady\}/);
    expect(source).toMatch(/key=\{autofocusReady \? 'editing-ready' : editing \? 'editing-pending' : 'readonly'\}/);
  });

  it('resets presentation readiness when the editor closes', () => {
    expect(source).toMatch(/if \(!visible\)\s*\{\s*sessionOpen\.current = false;\s*setPresentationReady\(false\);/);
  });

  it('never autofocuses a read-only note', () => {
    expect(source).toMatch(/const autofocusReady = editable && editing && presentationReady;/);
  });
});
