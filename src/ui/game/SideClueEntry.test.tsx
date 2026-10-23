import React from 'react';
import { AppState, Dimensions, StyleSheet, Text } from 'react-native';
import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';
import { SideClueEntry } from './SideClueEntry';
const { act, create } = require('react-test-renderer');
jest.mock('../designSystem', () => ({ useHanabTheme: () => ({ theme: { colors: { accent: '#fff', borderStrong: '#444', surfaceRaised: '#111' } } }) }));
let tree: any;
beforeEach(() => { (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; });
afterEach(() => { if (tree) act(() => tree.unmount()); tree = undefined; jest.restoreAllMocks(); });
const event = () => ({ stopPropagation: jest.fn() });
function control() { return tree.root.findAllByProps({ testID: 'clue-entry-A very long player name' }).find((node: any) => typeof node.props.onPress === 'function').props; }
function measure(textWidth = 28, width = 62, height = 48) {
  act(() => control().onLayout({ nativeEvent: { layout: { width, height } } }));
  const text = tree.root.findAllByProps({ testID: 'clue-entry-text-A very long player name' })[0];
  act(() => text.props.onLayout({ nativeEvent: { layout: { width: textWidth, height: 14 } } }));
}
function render(onPress: () => void, disabled = false, availableHeight = 49, fontScale = 1) {
  return <SideClueEntry key={`${fontScale}:${availableHeight}`} playerName="A very long player name" onPress={onPress} disabled={disabled} availableHeight={availableHeight} fontScale={fontScale}><Text numberOfLines={1}>A very long player name</Text></SideClueEntry>;
}
function tap() { act(() => control().onPressIn(event())); act(() => control().onPress(event())); }

test('one explicit full-name accessible control measures 62x48, name above Clue, with no hitSlop', () => {
  const select = jest.fn(); act(() => { tree = create(render(select)); });
  expect(control().disabled).toBe(true); tap(); expect(select).not.toHaveBeenCalled();
  measure(); expect(control().disabled).toBe(false);
  expect(control().accessibilityLabel).toBe('Clue to A very long player name');
  expect(StyleSheet.flatten(control().style)).toMatchObject({ width: 62, height: 48 });
  expect(control().hitSlop).toBeUndefined();
  tap(); expect(select).toHaveBeenCalledTimes(1);
  act(() => { control().onPressIn(event()); control().onLongPress(event()); control().onPress(event()); });
  expect(select).toHaveBeenCalledTimes(1);
});

test('permission and native clipping failures remain inert', () => {
  const select = jest.fn(); act(() => { tree = create(render(select)); });
  measure(55); tap(); expect(select).not.toHaveBeenCalled();
  measure(28, 62, 50); tap(); expect(select).not.toHaveBeenCalled();
  act(() => tree.update(render(select, true))); measure(); tap(); expect(select).not.toHaveBeenCalled();
});

test('resize remounts native probes even when glyph dimensions stay unchanged', () => {
  const select = jest.fn(); act(() => { tree = create(render(select)); }); measure();
  expect(control().disabled).toBe(false);
  act(() => tree.update(render(select, false, 52)));
  expect(control().disabled).toBe(true);
  measure(); expect(control().disabled).toBe(false); tap(); expect(select).toHaveBeenCalledTimes(1);
});

test.each(['rotate', 'background', 'cancel', 'blur'])('%s suppresses an interrupted clue touch', kind => {
  let background: any, rotate: any;
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_name, fn) => { background = fn; return { remove() {} }; });
  jest.spyOn(Dimensions, 'addEventListener').mockImplementation((_name, fn) => { rotate = fn; return { remove() {} } as ReturnType<typeof Dimensions.addEventListener>; });
  const select = jest.fn(); act(() => { tree = create(render(select)); }); measure();
  act(() => control().onPressIn(event()));
  act(() => { if (kind === 'rotate') rotate(); else if (kind === 'background') background('background'); else if (kind === 'cancel') control().onTouchCancel(); else control().onBlur(); });
  act(() => control().onPress(event())); expect(select).not.toHaveBeenCalled();
  tap(); expect(select).toHaveBeenCalledTimes(1);
});
