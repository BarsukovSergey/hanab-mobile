import React from 'react';
import { Text, View } from 'react-native';
import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';
import { readFileSync } from 'node:fs';
import type { RoomState } from '../store/roomSlice';
import { ActionButton, HanabThemeProvider } from './designSystem';
import { GameBootstrapStatus } from './GameBootstrapStatus';

const { act, create } = require('react-test-renderer');
let tree: ReturnType<typeof create>;
const onRetry = jest.fn();
const onBrowse = jest.fn();

function render(phase: 'pending_c5' | 'waiting_init' | 'waiting_history' | 'failed') {
  const room: Extract<RoomState, { kind: 'awaiting_game_bootstrap' }> = {
    kind: 'awaiting_game_bootstrap', tableID: 123, role: 'player', replay: false,
    expectedDatabaseID: null, expectedReplaySource: null, expectedReplayVisibility: null,
    tableStartReceived: true,
    bootstrap: phase === 'pending_c5' ? phase : { phase, gameLoadEpoch: 1, historyActionCount: 0 },
  };
  act(() => {
    tree = create(<HanabThemeProvider>
      <GameBootstrapStatus room={room} onRetry={onRetry} onBrowse={onBrowse} />
    </HanabThemeProvider>);
  });
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  jest.clearAllMocks();
});
afterEach(() => { if (tree) act(() => tree.unmount()); });

test.each(['pending_c5', 'waiting_init', 'waiting_history'] as const)('%s shows progress with Home and no Retry', (phase) => {
  render(phase);
  expect(tree.root.findAllByType(Text).some((node: { props: { children: unknown } }) => node.props.children === 'Loading game…')).toBe(true);
  const buttons = tree.root.findAllByType(ActionButton);
  expect(buttons.map((button: { props: { title: string } }) => button.props.title)).toEqual(['Home']);
  act(() => buttons[0].props.onPress());
  expect(onBrowse).toHaveBeenCalledTimes(1);
  expect(onRetry).not.toHaveBeenCalled();
});

test('terminal failure renders an accessible error and Retry invokes recovery only when pressed', () => {
  render('failed');
  const texts = tree.root.findAllByType(Text).map((node: { props: { children: unknown } }) => node.props.children);
  expect(texts).toContain('Unable to load game');
  expect(texts).not.toContain('Loading game…');
  expect(tree.root.findAllByType(View).some((node: { props: { accessibilityRole?: string } }) => node.props.accessibilityRole === 'alert')).toBe(true);
  expect(onRetry).not.toHaveBeenCalled();
  const buttons = tree.root.findAllByType(ActionButton);
  const retry = buttons.find((button: { props: { accessibilityLabel: string } }) => button.props.accessibilityLabel === 'Retry loading game');
  expect(tree.root.findAllByProps({ accessibilityRole: 'button', accessibilityLabel: 'Retry loading game' }).length).toBeGreaterThan(0);
  act(() => retry.props.onPress());
  expect(onRetry).toHaveBeenCalledTimes(1);
  expect(onBrowse).not.toHaveBeenCalled();
  const browse = buttons.find((button: { props: { title: string } }) => button.props.title === 'Home');
  act(() => browse.props.onPress());
  expect(onBrowse).toHaveBeenCalledTimes(1);
  expect(onRetry).toHaveBeenCalledTimes(1);
});

test('App routes the bootstrap surface through runtime recovery and Home', () => {
  const app = readFileSync('App.tsx', 'utf8');
  expect(app).toContain('<GameBootstrapStatus room={roomState.room}');
  expect(app).toContain('onRetry={() => { lobbyRuntime.retryGameBootstrap(); }} onBrowse={homeFromLive}');
  // With no owned room, only an active connection attempt may show recovery Return.
  const recovery = app.slice(app.indexOf('const recoveringRoom ='), app.indexOf('const returnPresentation ='));
  expect(recovery).toContain("roomState.room.kind !== 'none'");
  expect(recovery).toContain("|| ((session.phase === 'connecting' || session.phase === 'openAwaitingWelcome')");
});
