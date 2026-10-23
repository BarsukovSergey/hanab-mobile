import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from '@jest/globals';

const read = (name: string) => readFileSync(join(__dirname, name), 'utf8');

describe('gameplay presentation visibility', () => {
  test('the gameplay wrapper passes visibility to the C17 implementation and denies interaction on invalid metadata', () => {
    const wrapper = read('GameScreen.tsx');
    expect(wrapper).toContain('presentationVisible = true');
    expect(wrapper).toContain('<C17GameScreen noteBackRef={noteBackRef} presentationVisible={presentationVisible} roomChildren={roomChildren} heightConstrained={heightConstrained} landscapeHeader={landscapeHeader} landscapeHeaderMinWidth={landscapeHeaderMinWidth} />');
    expect(wrapper).not.toContain('LegacyGameScreen');
    expect(wrapper).toContain('pointerEvents="none"');
    expect(wrapper).toContain('unsupported or inconsistent player data');
  });

  test.each(['C17GameScreen.tsx'])(
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


test('own-action feedback observes authoritative advancement while hidden without sending', () => {
  const source = read('C17GameScreen.tsx');
  const observation = source.slice(source.indexOf('// Hidden-safe observation:'), source.indexOf('  const takeWorkbenchTask ='));
  expect(source).toContain('const lastObservedLiveSegmentRef = useRef(liveTransition.segment);');
  expect(observation).toContain('feedbackGameLoadEpochRef.current !== gameLoadEpoch');
  expect(observation).toContain('lastObservedLiveSegmentRef.current = liveTransition.segment;');
  expect(observation).toContain('setWorkbenchFeedback(null);');
  expect(observation).toContain('if (liveTransition.segment <= lastObservedLiveSegmentRef.current) return;');
  expect(observation).toContain('getC17OwnActionFeedback(liveEntries, lastObservedLiveSegmentRef.current, seatingAnchorIndex)');
  expect(observation).toContain('if (confirmation !== null');
  expect(observation).not.toMatch(/presentationVisible|lobbyRuntime|dispatch|setTimeout|setInterval/);
  const takeTask = source.slice(source.indexOf('  const takeWorkbenchTask ='), source.indexOf('  const [recentOpen'));
  expect(takeTask).toContain('setWorkbenchFeedback(null);');
  expect(takeTask).toContain('task();');
  expect(source).toContain('title="Close" onPress={() => setWorkbenchFeedback(null)}');
  const hidden = source.slice(source.indexOf('if (presentationVisible) return;'), source.indexOf('}, [presentationVisible]);'));
  expect(hidden).not.toContain('setWorkbenchFeedback');
  const rotation = source.slice(source.indexOf('if (orientationRef.current === orientation)'), source.indexOf('}, [orientation]);'));
  expect(rotation).not.toContain('setWorkbenchFeedback');
});

test('deliberate Workbench tasks consume delayed confirmations without replacing their controls', () => {
  const source = read('C17GameScreen.tsx');
  const taskPolicy = source.slice(source.indexOf('  const workbenchTaskActive ='), source.indexOf('// Hidden-safe observation:'));
  expect(taskPolicy).toContain('hypothetical !== null || reviewActive || finishedReplay || sharedReplay !== null');
  expect(taskPolicy).toContain('selectedTarget !== null || selectedActionCard !== null || noteCard !== null');
  expect(taskPolicy).not.toContain('presentationVisible');
  expect(source.indexOf('  const selectedActionCard =')).toBeLessThan(source.indexOf('  const workbenchTaskActive ='));
  expect(source).toContain('selectedCard !== null && displayedActionHand.some((order) => order === selectedCard) ? selectedCard : null');

  const observation = source.slice(source.indexOf('// Hidden-safe observation:'), source.indexOf('  const takeWorkbenchTask ='));
  expect(observation).toMatch(/const confirmation = getC17OwnActionFeedback\([^;]+;\s*lastObservedLiveSegmentRef.current = liveTransition.segment;\s*if \(confirmation !== null && !isSpectator && !workbenchTaskActive\) \{\s*setWorkbenchFeedback\(confirmation\);\s*\}/);
  expect(observation).toContain('isSpectator, workbenchTaskActive]);');
  expect(observation).not.toMatch(/presentationVisible|lobbyRuntime|dispatch|setTimeout|setInterval/);
});
