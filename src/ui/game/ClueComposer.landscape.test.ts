import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { describe, expect, jest, test } from '@jest/globals';
import { SUPPORTED_VARIANT_NAMES } from '../../game/client/supportedVariants';
import { getGameplayClueChoices } from '../../game/selectors/gameplay';
import { ClueComposer } from './ClueComposer';
import { getLandscapeWorkbenchEnvelope } from './landscapeWorkbench';

let mockFontScale = 1;
jest.mock('../designSystem', () => ({
  useHanabTheme: () => ({ theme: { colors: { text: '#fff', textMuted: '#bbb', accent: '#080' } } }),
  useResponsiveLayout: () => ({ width: 860, height: 392, fontScale: mockFontScale }),
}));

type Element = ReactElement<Record<string, any>>;
function nodes(node: ReactNode, ancestors: Element[] = []): Array<{ node: Element; ancestors: Element[] }> {
  if (Array.isArray(node)) return node.flatMap((child) => nodes(child, ancestors));
  if (!isValidElement<Record<string, any>>(node)) return [];
  return [{ node, ancestors }, ...nodes(node.props.children, [...ancestors, node])];
}
function text(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(text).join('');
  return isValidElement<{ children: ReactNode }>(node) ? text(node.props.children) : '';
}
const expanded = SUPPORTED_VARIANT_NAMES.map((name) => ({ name, choices: getGameplayClueChoices(name) }))
  .sort((a, b) => b.choices.colors.length + b.choices.ranks.length - a.choices.colors.length - a.choices.ranks.length)[0]!;

describe('bounded landscape Clue Composer', () => {
  test.each([1, 1.3, 1.5, 2])('font %s keeps every choice scrollable with Give/Close outside scroll ownership', (fontScale) => {
    mockFontScale = fontScale;
    expect(Math.max(expanded.choices.colors.length, expanded.choices.ranks.length)).toBeGreaterThan(5);
    const tree = ClueComposer({ dense: true, boundedLandscape: true, targetName: 'Bob',
      variantName: expanded.name, choices: expanded.choices, enabled: true, previewState: null, preview: null,
      onClear: jest.fn(), onConfirm: jest.fn(), onPreview: jest.fn() });
    const all = nodes(tree);
    const scrolls = all.filter(({ node }) => node.type === ScrollView);
    expect(scrolls).toHaveLength(2);
    const envelope = getLandscapeWorkbenchEnvelope(fontScale);
    for (const { node } of scrolls) {
      expect(node.props.horizontal).toBe(true);
      expect(StyleSheet.flatten(node.props.style)).toMatchObject({ height: envelope.choiceHeight, flexGrow: 0 });
      expect(StyleSheet.flatten(node.props.contentContainerStyle)).toMatchObject({ flexWrap: 'nowrap' });
    }
    const choices = all.filter(({ node }) => node.type === Pressable && (node.key?.startsWith('color-') || node.key?.startsWith('rank-')));
    expect(choices).toHaveLength(expanded.choices.colors.length + expanded.choices.ranks.length);
    for (const label of ['Close', 'Give']) {
      const control = all.find(({ node }) => node.type === Pressable && text(node.props.children) === label)!;
      expect(control).toBeDefined();
      expect(control.ancestors.some((ancestor) => ancestor.type === ScrollView)).toBe(false);
      expect(StyleSheet.flatten(control.node.props.style({ pressed: false }))).toMatchObject({ height: envelope.footerHeight });
    }
  });

  test('candidate taps only preview; eligible Give commits once through its explicit callback', () => {
    mockFontScale = 1;
    const onPreview = jest.fn();
    const onConfirm = jest.fn();
    const onClear = jest.fn();
    const render = (enabled = true) => nodes(ClueComposer({ dense: true, boundedLandscape: true,
      targetName: 'Bob', choices: getGameplayClueChoices('No Variant'), enabled,
      previewState: { type: 'rank', value: 1 },
      preview: { type: 'rank', value: 1, targetPlayerIndex: 1, touchedOrders: [7] },
      onPreview, onConfirm, onClear }));
    const candidate = render().find(({ node }) => node.type === Pressable && node.props.accessibilityLabel === '1')!.node;
    candidate.props.onPress();
    expect(onPreview).toHaveBeenCalledWith('rank', 1);
    expect(onConfirm).not.toHaveBeenCalled();
    const give = render().find(({ node }) => node.type === Pressable && text(node.props.children) === 'Give')!.node;
    expect(give.props.disabled).toBe(false);
    give.props.onPress();
    expect(onConfirm).toHaveBeenCalledTimes(1);
    const disabledGive = render(false).find(({ node }) => node.type === Pressable && text(node.props.children) === 'Give')!.node;
    expect(disabledGive.props.disabled).toBe(true);
    render().find(({ node }) => node.type === Pressable && text(node.props.children) === 'Close')!.node.props.onPress();
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  test('a stress palette beyond current variants stays in exactly two local scroll rows', () => {
    const choices = { colors: Array.from({ length: 24 }, (_, value) => ({ value, label: `Color ${value}` })),
      ranks: Array.from({ length: 24 }, (_, value) => ({ value, label: `Rank ${value}` })), allowEmptyClues: false };
    const all = nodes(ClueComposer({ dense: true, boundedLandscape: true, targetName: 'Bob', choices,
      enabled: false, previewState: null, preview: null, onClear: jest.fn(), onConfirm: jest.fn(), onPreview: jest.fn() }));
    expect(all.filter(({ node }) => node.type === ScrollView)).toHaveLength(2);
    expect(all.filter(({ node }) => node.type === Pressable && (node.key?.startsWith('color-') || node.key?.startsWith('rank-')))).toHaveLength(48);
    expect(all.find(({ node }) => node.type === Pressable && text(node.props.children) === 'Give')!.node.props.disabled).toBe(true);
  });
});
