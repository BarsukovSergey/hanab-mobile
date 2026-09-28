import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from '@jest/globals';

const read = (name: string) => readFileSync(join(__dirname, name), 'utf8');

describe('gameplay presentation visibility', () => {
  test('the gameplay wrapper passes visibility to both implementations', () => {
    const wrapper = read('GameScreen.tsx');
    expect(wrapper).toContain('presentationVisible = true');
    expect(wrapper).toContain('<C17GameScreen presentationVisible={presentationVisible} />');
    expect(wrapper).toContain('<LegacyGameScreen presentationVisible={presentationVisible} />');
  });

  test.each(['C17GameScreen.tsx', 'LegacyGameScreen.tsx'])(
    '%s disarms hidden gameplay and keeps lifecycle interruption separate from runtime sends', (name) => {
      const source = read(name);
      const hide = source.match(/useEffect\(\(\) => \{\s*if \(presentationVisible\) return;[\s\S]*?\}, \[presentationVisible\]\);/)?.[0] ?? '';
      expect(hide).toContain("interactionDispatch({ type: 'disarm-gameplay' })");
      expect(source).toContain("interactionDispatch({ type: 'interrupt-lifecycle' })");
      expect(source).toContain("interactionDispatch({ type: 'reset-for-game-load' })");
      expect(source).toContain('const currentGameLoad = gameLoadEpochRef.current === gameLoadEpoch;');
      expect(source).toMatch(/interactionDispatch\(\{ type: 'reset-for-game-load' \}\);\s*setNoteEditorOpen\(false\);\s*setNote\(''\);/);
      expect(source).toContain('presentationVisible={presentationVisible}');
      expect(source).toContain('visible={presentationVisible && discardViewerOpen}');
      expect(source).toContain('visible={presentationVisible && recentOpen}');
      expect(source).toContain('visible={presentationVisible && efficiencyDetailsOpen}');
      expect(source).toContain('visible={presentationVisible && paceDetailsOpen}');
      expect(hide).not.toMatch(/lobbyRuntime\.|onSave\(|onClose\(/);
      const background = source.match(/AppState\.addEventListener\('change', \(state\) => \{[\s\S]*?\}\);/)?.[0] ?? '';
      expect(background).toContain("interactionDispatch({ type: 'interrupt-lifecycle' })");
      expect(background).not.toMatch(/lobbyRuntime\.|onSave\(|onClose\(/);
    },
  );

  test('hypothetical morph inspection cannot remain above a hidden C17 room', () => {
    const source = read('C17GameScreen.tsx');
    expect(source).toContain('visible={presentationVisible && morphOrder !== null');
    expect(source).toMatch(/if \(presentationVisible\) return;\s*longPressedOpponent\.current = null;[\s\S]*?setMorphOrder\(null\);/);
  });
});
