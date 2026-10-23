import React from 'react';
import { AppState, Dimensions, Pressable, StyleSheet } from 'react-native';
import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';
import { GameCard, VisibleHanabiCard } from './GameCard';
import type { CardKnowledgeViewModel } from '../../game/selectors/cardKnowledge';

const { act, create } = require('react-test-renderer');
jest.mock('../designSystem', () => ({ useHanabTheme: () => ({ theme: { colors: { accent: '#123456', text: '#ffffff', surfaceRaised: '#111111', border: '#888888' } } }) }));
jest.mock('./UpstreamCardFace', () => ({ UpstreamCardFace: () => null }));
let tree: any;
beforeEach(() => { (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; jest.useFakeTimers(); });
afterEach(() => { if (tree) act(() => tree.unmount()); tree = undefined; jest.restoreAllMocks(); jest.useRealTimers(); });
const knowledge = { displayRank: null, displaySuitIndex: null, borderColor: null, suitPips: [], rankPips: [] } as unknown as CardKnowledgeViewModel;
const event = () => ({ stopPropagation: jest.fn() });
function responder() { return tree.root.findAll((node: any) => node.props.delayLongPress === 350 && typeof node.props.onPressIn === 'function')[0].props; }
function tap() { act(() => responder().onPressIn(event())); act(() => responder().onPress(event())); act(() => responder().onPressOut(event())); }

test('own taps select immediately even twice slowly; hold consumes tap and never selects', () => {
  const select = jest.fn(), note = jest.fn();
  act(() => { tree = create(<GameCard position={0} knowledge={knowledge} selected={false} variantName="No Variant" onSelect={select} onLongPress={note} />); });
  tap(); act(() => jest.advanceTimersByTime(800)); tap(); expect(select).toHaveBeenCalledTimes(2); expect(note).not.toHaveBeenCalled();
  act(() => responder().onPressIn(event()));
  act(() => responder().onLongPress(event()));
  act(() => responder().onPressOut(event()));
  const release = event(); act(() => responder().onPress(release));
  expect(release.stopPropagation).toHaveBeenCalled();
  expect(note).toHaveBeenCalledTimes(1); expect(select).toHaveBeenCalledTimes(2);
});

test.each(['terminate', 'blur', 'rotate', 'background'])('%s cancels the card gesture until a fresh press', interruption => {
  let background: any, rotate: any;
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_name, fn) => { background = fn; return { remove() {} }; });
  jest.spyOn(Dimensions, 'addEventListener').mockImplementation((_name, fn) => { rotate = fn; return { remove() {} } as ReturnType<typeof Dimensions.addEventListener>; });
  const inspect = jest.fn(), empathy = jest.fn(), release = jest.fn();
  act(() => { tree = create(<VisibleHanabiCard suitIndex={0} rank={1} variantName="No Variant" onPress={inspect} onLongPress={empathy} onPressOut={release} />); });
  act(() => responder().onPressIn(event()));
  act(() => responder().onLongPress(event()));
  act(() => { if (interruption === 'terminate') responder().onTouchCancel(); else if (interruption === 'blur') responder().onBlur(); else if (interruption === 'rotate') rotate(); else background('background'); });
  act(() => responder().onPress(event()));
  expect(inspect).not.toHaveBeenCalled(); expect(release).toHaveBeenCalled();
  tap(); expect(inspect).toHaveBeenCalledTimes(1);
});

test('preview is inset, high contrast and distinct from committed arrows at the 68dp card floor', () => {
  const marker = { kind: 'rank' as const, value: 1, label: '1', retouched: false };
  act(() => { tree = create(<VisibleHanabiCard suitIndex={0} rank={1} height={68} variantName="No Variant" clueMarker={marker} />); });
  expect(tree.root.findAllByProps({ testID: 'clue-preview-highlight' })).toHaveLength(0);
  act(() => tree.update(<VisibleHanabiCard suitIndex={0} rank={1} height={68} variantName="No Variant" clueMarker={marker} previewMarker={marker} />));
  expect(tree.root.findAllByProps({ testID: 'clue-preview-highlight' }).length).toBeGreaterThan(0);
  const badge = tree.root.findAllByProps({ accessibilityLabel: 'Clue preview 1' })[0];
  const style = StyleSheet.flatten(badge.props.style);
  expect(style.width).toBeGreaterThanOrEqual(22); expect(style.top).toBe(2);
  expect(style.width).toBeLessThan(68 * 286 / 406);
});


test('departed held card releases empathy; unheld card unmount does not clear another hold', () => {
  const release = jest.fn();
  act(() => { tree = create(<VisibleHanabiCard suitIndex={0} rank={1} variantName="No Variant" onLongPress={() => {}} onPressOut={release} />); });
  act(() => responder().onPressIn(event())); act(() => responder().onLongPress(event()));
  act(() => tree.unmount()); tree = undefined;
  expect(release).toHaveBeenCalledTimes(1);
  act(() => { tree = create(<VisibleHanabiCard suitIndex={0} rank={1} variantName="No Variant" onLongPress={() => {}} onPressOut={release} />); });
  act(() => tree.unmount()); tree = undefined;
  expect(release).toHaveBeenCalledTimes(1);
});


test.each([0, 3])('light color %s keeps a dark badge outline and shadowed equivalent symbol', color => {
  act(() => { tree = create(<VisibleHanabiCard suitIndex={0} rank={1} height={68} variantName="No Variant" previewMarker={{ kind: 'color', value: color, label: 'Color', retouched: false }} />); });
  const badge = tree.root.findAll((node: any) => Array.isArray(node.props.style) && node.props.style.some((style: any) => style?.borderWidth === 2 && style?.borderColor === '#111111'));
  expect(badge.length).toBeGreaterThan(0);
  const symbol = tree.root.findAll((node: any) => node.props.children === '?' && node.props.style);
  expect(StyleSheet.flatten(symbol[0].props.style).textShadowColor).toBe('#000000');
});


test('native Pressable termination releases a recognized hold without a short tap', () => {
  const inspect = jest.fn(), hold = jest.fn(), release = jest.fn();
  act(() => { tree = create(<VisibleHanabiCard suitIndex={0} rank={1} variantName="No Variant" onPress={inspect} onLongPress={hold} onPressOut={release} />); });
  const host = tree.root.findAll((node: any) => typeof node.type === 'string' && typeof node.props.onResponderGrant === 'function')[0];
  const native = { ...event(), persist() {}, currentTarget: 1, nativeEvent: { pageX: 10, pageY: 10, timestamp: 0 } };
  act(() => host.props.onResponderGrant(native));
  act(() => jest.advanceTimersByTime(400));
  expect(hold).toHaveBeenCalledTimes(1);
  act(() => host.props.onResponderTerminate(native));
  expect(release).toHaveBeenCalled(); expect(inspect).not.toHaveBeenCalled();
});
