import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';
import type { CardKnowledgeViewModel } from '../../game/selectors/cardKnowledge';
import { GameCard, VisibleHanabiCard } from './GameCard';

const { act, create } = require('react-test-renderer');
jest.mock('../designSystem', () => ({ useHanabTheme: () => ({ theme: { colors: { accent: '#080', text: '#fff' } } }) }));
jest.mock('./UpstreamCardFace', () => ({ UpstreamCardFace: () => null }));
jest.mock('react-native/Libraries/Components/Pressable/Pressable', () => {
  return { __esModule: true, default: function MockPressable(props: object) {
    return require('react').createElement(require('react-native').View, props);
  } };
});
const knowledge: CardKnowledgeViewModel = { order: 7, hasClueApplied: false, displaySuitIndex: null,
  displayRank: null, borderColor: null, positiveColorLabels: [], positiveRanks: [], possibleSuitLabels: [],
  possibleRanks: [], suitPips: [], rankPips: [], suitDetermined: false, rankDetermined: false };
let tree: ReturnType<typeof create>;
beforeEach(() => { (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true; tree = undefined; });
afterEach(() => { if (tree) act(() => tree.unmount()); });

test.each(['own', 'visible'] as const)('%s card has immediate taps and consumes holds/cancellation without a second action', (kind) => {
  const tap = jest.fn(), hold = jest.fn(), release = jest.fn();
  act(() => { tree = create(kind === 'own'
    ? <GameCard position={0} knowledge={knowledge} selected={false} variantName="No Variant" onSelect={tap} onLongPress={hold} onPressOut={release} />
    : <VisibleHanabiCard suitIndex={0} rank={1} variantName="No Variant" onPress={tap} onLongPress={hold} onPressOut={release} />); });
  const touch = () => tree.root.findByType(Pressable).props;
  for (let index = 0; index < 2; index++) act(() => { touch().onPressIn(); touch().onPress(); touch().onPressOut(); });
  expect(tap).toHaveBeenCalledTimes(2); // no timer or double-tap branch
  act(() => { touch().onPressIn(); touch().onLongPress(); touch().onPressOut(); touch().onPress(); });
  expect(hold).toHaveBeenCalledTimes(1);
  expect(tap).toHaveBeenCalledTimes(2);
  for (const cancel of ['onTouchCancel', 'onResponderTerminate']) {
    act(() => { touch().onPressIn(); touch()[cancel](); touch().onPress(); });
    expect(tap).toHaveBeenCalledTimes(2);
  }
  act(() => { touch().onPressIn(); touch().onPress(); });
  expect(tap).toHaveBeenCalledTimes(3);
});

test.each([68, 112])('preview at %sdp uses a separate high-contrast highlight and a badge larger than 11dp', (height) => {
  const marker = { kind: 'rank' as const, value: 1, label: '1', retouched: false };
  act(() => { tree = create(<GameCard position={0} knowledge={knowledge} selected={false} variantName="No Variant"
    height={height} onSelect={() => {}} clueMarker={marker} />); });
  expect(tree.root.findAllByProps({ testID: 'clue-preview-highlight' })).toHaveLength(0);
  act(() => tree.update(<GameCard position={0} knowledge={knowledge} selected={false} variantName="No Variant"
    height={height} onSelect={() => {}} clueMarker={marker} previewMarker={marker} />));
  expect(tree.root.findAllByProps({ testID: 'clue-preview-highlight' }).length).toBeGreaterThan(0);
  const badge = StyleSheet.flatten(tree.root.findAllByProps({ testID: 'clue-preview-badge' })[0].props.style);
  expect(badge.width).toBeGreaterThanOrEqual(18);
  expect(badge).toMatchObject({ backgroundColor: '#111111', borderColor: '#ffffff', borderWidth: 2 });
});
