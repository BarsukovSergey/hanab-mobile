import { readFileSync } from 'node:fs';
import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { describe, expect, jest, test } from '@jest/globals';

import type { GameState } from '../../game/bootstrap/types';
import { getGameResourcePresentation } from '../../game/selectors/gameResourcePresentation';
import { AuthoritativePulse } from './AuthoritativePulse';
import { CompactTable, TableScore } from './CompactTable';

// Inspect the actual JSX without mounting native cards or running animation effects.
let mockAvailableWidth = 400;
jest.mock('react', () => ({
  ...require('@jest/globals').jest.requireActual('react'),
  useState: () => [mockAvailableWidth, () => {}],
}));
jest.mock('../designSystem', () => ({
  useHanabTheme: () => ({ theme: { colors: { text: '#eeeeee' } } }),
  useResponsiveLayout: () => ({ width: 400, height: 800 }),
}));
jest.mock('../../store/hooks', () => ({ useAppSelector: () => undefined }));
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 400, height: 800, scale: 1, fontScale: 1 }),
}));
jest.mock('./GameCard', () => ({ VisibleHanabiCard: () => null }));
jest.mock('./UpstreamPip', () => ({ hasUpstreamSvgPip: () => false }));
jest.mock('../../game/selectors/discardSummary', () => ({
  getDiscardSummary: () => ({ total: 0, suits: [] }),
}));
jest.mock('../../game/selectors/discardPresentation', () => ({
  getDiscardPresentation: () => ({ cards: [], relevantCards: [] }),
}));

type Element = ReactElement<Record<string, unknown>>;
type Props = Parameters<typeof CompactTable>[0];
const variantName = 'No Variant';

function nodes(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!isValidElement<Record<string, unknown>>(node)) return [];
  if (node.type === TableScore) return nodes(TableScore(node.props as Parameters<typeof TableScore>[0]));
  return [node, ...nodes(node.props.children as ReactNode)];
}

function text(node: Element): string {
  const children = node.props.children;
  return (Array.isArray(children) ? children : [children])
    .filter((child) => typeof child === 'string' || typeof child === 'number').join('');
}

function game(clueTokens = 2): GameState {
  return {
    clueTokens, score: 4, strikes: [], cardsRemainingInTheDeck: 30,
    playStacks: [], discardStacks: [], deck: [], stats: { maxScore: 25, doubleDiscardCard: null },
  } as unknown as GameState;
}

function table(presentation: 'portrait-v2' | 'landscape-v2', overrides: Partial<Props> = {}) {
  const v2 = CompactTable({ game: game(), variantName, presentation, ...overrides });
  const render = v2.type as (props: unknown) => Element;
  const root = render(v2.props);
  const all = nodes(root);
  if (presentation === 'landscape-v2') all.push(...nodes(TableScore({ game: overrides.game ?? game(), feedback: overrides.landscapeResourceFeedback, pulseEnabled: overrides.pulseEnabled, landscape: true })));
  const clue = all.find((node) => text(node).startsWith('Clues '))!;
  const score = all.find((node) => text(node).startsWith('Score '))!;
  const pulses = all.filter((node) => node.type === AuthoritativePulse && nodes(node.props.children as ReactNode)
    .some((child) => /^(Clues |Score )/.test(text(child)) || /^(Strikes |Deck )/.test(String(child.props.accessibilityLabel))));
  return { root, clue, score, pulses, all };
}

describe.each(['portrait-v2', 'landscape-v2'] as const)('%s resource semantics', (presentation) => {
  test.each([variantName, 'Clue Starved (5 Suits)'])('uses supplied zero/one/max/default clue cues for %s', (variantName) => {
    // Thresholds belong to the selector tests; the renderer must trust its cue,
    // including a maximum cue without assuming a particular numeric maximum.
    for (const [clueCue, color] of [
      ['no-clues', '#ff5555'],
      ['one-clue', '#ffd54f'],
      ['max-clues', '#aaff00'],
      ['default', '#eeeeee'],
    ] as const) {
      const result = table(presentation, { variantName,
        landscapeResourceFeedback: { clueCue, before: undefined, segment: null, lowScorePhase: false, colorblindMode: false } });
      expect(result.clue.props.style).toMatchObject({ color });
    }
  });

  test.each([false, true])('preserves Low Score cyan and colorblind=%s underline', (colorblindMode) => {
    for (const lowScorePhase of [false, true]) {
      const { score } = table(presentation, { landscapeResourceFeedback: {
        before: undefined, segment: null, clueCue: 'default', lowScorePhase, colorblindMode,
      } });
      expect(score.props.style).toMatchObject({ color: lowScorePhase ? '#00ffff' : '#eeeeee' });
      expect((score.props.style as Record<string, unknown>).textDecorationLine)
        .toBe(lowScorePhase && colorblindMode ? 'underline' : undefined);
    }
  });

  test.each([
    { realLifeMode: true, showResourceCues: true },
    { realLifeMode: false, showResourceCues: false },
  ])('honors suppressed resource cues: %j', (suppression) => {
    for (const tokens of [0, 1, 2]) {
      const current = game(tokens);
      const { clueCue } = getGameResourcePresentation({ game: current, variantName,
        hyphenatedConventions: true, ...suppression });
      expect(table(presentation, { game: current, landscapeResourceFeedback: {
        before: undefined, segment: null, clueCue, lowScorePhase: false, colorblindMode: true,
      } }).clue.props.style).toMatchObject({ color: '#eeeeee' });
    }
    const fallback = table(presentation);
    expect(fallback.clue.props.style).toMatchObject({ color: '#eeeeee' });
    expect(fallback.score.props.style).toMatchObject({ color: '#eeeeee' });
  });

  test('pulses changed resources only with previous state and an authoritative segment', () => {
    const current = game();
    const strike = { segment: 16, order: 0 as GameState['strikes'][number]['order'] };
    const changed: GameState = { ...current, clueTokens: 3, score: 5,
      strikes: [strike], cardsRemainingInTheDeck: 29 };
    for (const [before, segment, expected] of [
      [changed, 17, 17], [current, 17, null], [undefined, 17, null], [changed, null, null],
    ] as const) {
      for (const pulseEnabled of [false, true]) {
        const { pulses } = table(presentation, { game: current, pulseEnabled, landscapeResourceFeedback: {
          before, segment, clueCue: 'default', lowScorePhase: false, colorblindMode: false,
        } });
        expect(pulses).toHaveLength(4);
        for (const pulse of pulses) {
          expect(pulse.props.pulseKey).toBe(expected);
          expect(pulse.props.enabled).toBe(pulseEnabled);
        }
      }
    }
    const individualChanges: Partial<GameState>[] = [
      { score: 5 }, { clueTokens: 3 }, { strikes: [strike] },
      { cardsRemainingInTheDeck: 29 },
    ];
    individualChanges.forEach((change, index) => {
      const { pulses } = table(presentation, { game: current, landscapeResourceFeedback: {
        before: { ...current, ...change }, segment: 17, clueCue: 'default', lowScorePhase: false, colorblindMode: false,
      } });
      expect(pulses.map((pulse) => pulse.props.pulseKey)).toEqual(
        (presentation === 'landscape-v2' ? [1, 2, 3, 0] : [0, 1, 2, 3]).map((slot) => slot === index ? 17 : null),
      );
    });
  });
});

test('retains distinct orientation geometry and responsive portrait resource placement', () => {
  mockAvailableWidth = 400;
  const portrait = table('portrait-v2');
  const landscape = table('landscape-v2');
  expect(portrait.root.props.style).not.toHaveProperty('height');
  expect(landscape.root.props.style).toMatchObject({ height: 92, flexShrink: 0 });
  expect(portrait.score.props.style).toMatchObject({ fontSize: 12 });
  expect(landscape.score.props.style).toMatchObject({ fontSize: 10 });
  expect(nodes(landscape.root).filter((node) => text(node).startsWith('Score '))).toHaveLength(0);
  expect(nodes(portrait.root).filter((node) => text(node).startsWith('Score '))).toHaveLength(1);
  expect(landscape.clue.props.numberOfLines).toBe(1);
  expect(portrait.clue.props.numberOfLines).toBeUndefined();
  const rail = (result: ReturnType<typeof table>) => result.all.find((node) =>
    (node.props.style as Record<string, unknown> | undefined)?.minWidth !== undefined)!;
  expect(rail(portrait).props.style).toMatchObject({ minWidth: 64, flexDirection: 'column' });
  expect(rail(landscape).props.style).toMatchObject({ minWidth: 58, flexDirection: 'column' });
  mockAvailableWidth = 200;
  expect(rail(table('portrait-v2')).props.style).toMatchObject({ flexDirection: 'row' });
  expect(rail(table('landscape-v2')).props.style).toMatchObject({ flexDirection: 'column' });
  mockAvailableWidth = 400;
});

test('retains shared reduced-motion and pulse eligibility guards', () => {
  const pulse = readFileSync('src/ui/game/AuthoritativePulse.tsx', 'utf8');
  expect(pulse).toContain('!enabled || pulseKey === null || pulseKey === previousPulseKey.current || reduceMotion');
  expect(pulse).toContain('AccessibilityInfo.isReduceMotionEnabled()');
  expect(pulse).toContain("AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion)");
});

test('C17 supplies the same authoritative feedback through its shared orientation path', () => {
  const c17 = readFileSync('src/ui/game/C17GameScreen.tsx', 'utf8');
  expect(c17).toMatch(/<CompactTable presentation=\{portraitV2 \? 'portrait-v2' : 'landscape-v2'\}\s+landscapeResourceFeedback=\{\{ before: liveBefore, segment: livePulseSegment, clueCue: resourcePresentation.clueCue, lowScorePhase: hGroupStatus.lowScorePhase, colorblindMode \}\}/);
  expect(c17).toContain('pulseEnabled={livePulseEnabled}');
});
