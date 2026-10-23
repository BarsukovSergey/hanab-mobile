import React from 'react';
import { Modal, ScrollView, StyleSheet, TextInput } from 'react-native';
import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';
import { ActionButton } from '../designSystem';
import { NoteEditor } from './NoteEditor';

const { act, create } = require('react-test-renderer');
let mockIme = 0;
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, left: 28, right: 0, bottom: 16 }) }));
jest.mock('../../store/hooks', () => ({ useAppSelector: () => ({ variantName: 'No Variant', turn: 5 }) }));
jest.mock('../designSystem', () => ({
  useHanabTheme: () => ({ theme: { colors: {} } }),
  useResponsiveLayout: () => ({ fontScale: 1, imeOcclusion: mockIme, systemInsets: { bottom: 16 } }),
  Field: (props: object) => require('react').createElement(require('react-native').TextInput, props),
  ActionButton: (props: { title: string }) => require('react').createElement(require('react-native').Text, {}, props.title),
}));

let tree: ReturnType<typeof create>;
let props: React.ComponentProps<typeof NoteEditor>;
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  mockIme = 0;
  tree = undefined;
  props = { title: 'Ada card', value: 'old', editable: true, visible: true, startEditing: true,
    inlinePane: { width: 270, height: 400 }, backRef: { current: null },
    onChange: jest.fn(), onSave: jest.fn(), onClose: jest.fn() };
});
afterEach(() => { if (tree) act(() => tree.unmount()); });
function render(patch: Partial<typeof props> = {}) {
  props = { ...props, ...patch };
  act(() => { if (tree) tree.update(<NoteEditor {...props} />); else tree = create(<NoteEditor {...props} />); });
  measureFooter();
}
function measureFooter(width = 150, height = 44) {
  const probe = tree.root.findAllByProps({ testID: 'note-editor-footer-probe' })[0];
  if (probe) act(() => probe.props.onLayout({ nativeEvent: { layout: { width, height } } }));
}
function field() { return tree.root.findByType(TextInput); }
function button(title: string) { return tree.root.findAllByType(ActionButton).find((node: any) => node.props.title === title && node.props.disabled !== true)!; }

test('opens editable without focus, keeps sticky Save/Cancel outside scrolling, and quick actions only edit the draft', () => {
  render();
  expect(tree.root.findAllByType(Modal)).toHaveLength(0);
  expect(field().props).toMatchObject({ editable: true, autoFocus: false, value: 'old | ' });
  const scroll = tree.root.findByType(ScrollView);
  expect(scroll.findAllByType(ActionButton).map((node: any) => node.props.title)).not.toContain('Save');
  expect(scroll.findAllByType(ActionButton).map((node: any) => node.props.title)).not.toContain('Cancel');
  act(() => button('F').props.onPress());
  expect(props.onSave).not.toHaveBeenCalled();
  expect(field().props.value).toContain('f');
  act(() => button('Clear').props.onPress());
  expect(field().props.value).toBe('');
  act(() => field().props.onChangeText('new draft'));
  act(() => button('Save').props.onPress());
  expect(props.onSave).toHaveBeenCalledWith('new draft');
});

test('rotation, hiding, IME and permission changes preserve one draft without forcing keyboard or hidden sends', () => {
  render();
  act(() => field().props.onChangeText('unsaved'));
  mockIme = 260;
  render();
  expect(StyleSheet.flatten(tree.root.findAllByProps({ testID: 'note-editor-pane' })[0].props.style)).toMatchObject({ width: 270, height: 156 });
  expect(button('Save')).toBeDefined();
  render({ inlinePane: null });
  act(() => tree.root.findByType(Modal).props.onShow());
  expect(field().props).toMatchObject({ value: 'unsaved', autoFocus: false });
  render({ inlinePane: { width: 270, height: 400 }, presentationVisible: false });
  expect(props.backRef!.current).toBe(null);
  render({ presentationVisible: true, editable: false });
  expect(field().props).toMatchObject({ value: 'unsaved', editable: false, autoFocus: false });
  expect(field().props.onSubmitEditing).toBeUndefined();
  expect(button('Save')).toBeUndefined();
  render({ editable: true });
  expect(field().props.value).toBe('unsaved');
  expect(props.onSave).not.toHaveBeenCalled();
  act(() => props.backRef!.current!());
  expect(props.onClose).toHaveBeenCalledTimes(1);
  expect(props.onChange).toHaveBeenLastCalledWith('old');
  expect(props.onSave).not.toHaveBeenCalled();
});

test('portrait initial edit still waits for native presentation before autofocus; Cancel restores saved text', () => {
  render({ inlinePane: null });
  expect(field().props.autoFocus).toBe(false);
  act(() => tree.root.findByType(Modal).props.onShow());
  expect(field().props.autoFocus).toBe(true);
  act(() => field().props.onChangeText('discard me'));
  act(() => tree.root.findByType(Modal).props.onRequestClose());
  expect(props.onChange).toHaveBeenLastCalledWith('old');
  expect(props.onClose).toHaveBeenCalledTimes(1);
  expect(props.onSave).not.toHaveBeenCalled();
});


test('a native footer taller or wider than the IME window never exposes partial actions and retains the draft', () => {
  render();
  act(() => field().props.onChangeText('keep me'));
  mockIme = 320;
  render({ inlinePane: { width: 270, height: 324 } });
  expect(tree.root.findAllByType(TextInput)).toHaveLength(0);
  expect(button('Save')).toBeUndefined();
  expect(tree.root.findAllByProps({ accessibilityRole: 'alert' }).length).toBeGreaterThan(0);
  expect(props.onSave).not.toHaveBeenCalled();
  mockIme = 0;
  render({ inlinePane: { width: 504, height: 400 } });
  measureFooter(300, 64); // supplied enlarged-font native envelope
  expect(field().props.value).toBe('keep me');
  mockIme = 380;
  render();
  measureFooter(300, 64);
  expect(tree.root.findAllByType(TextInput)).toHaveLength(0);
  mockIme = 0;
  render();
  measureFooter(300, 64);
  expect(field().props.value).toBe('keep me');
  expect(props.onSave).not.toHaveBeenCalled();
});
