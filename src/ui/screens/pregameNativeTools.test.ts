import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from '@jest/globals';

const source = readFileSync(resolve(__dirname, 'PregameScreen.tsx'), 'utf8').replace(/\r\n/g, '\n');

describe('pregame native tools', () => {
  test('confirms owner kicks and sends through chat only after confirmation', () => {
    expect(source).toContain('import { Alert, StyleSheet, Text, View } from \'react-native\'');
    expect(source).toContain('isOwner && (');
    expect(source).toContain('{!player.you && (');
    expect(source).toContain('Alert.alert(');
    expect(source).toContain('style: \'destructive\'');
    expect(source).toContain('onPress: () => { chatRuntime.submit(`/kick ${player.name}`); }');
  });

  test('exposes server chat team tools disabled during transitions or with fewer than two players', () => {
    expect(source).toContain('title="Team tools"');
    expect(source).toContain('title="Find variant"');
    expect(source).toContain("chatRuntime.submit('/findvariant')");
    expect(source).toContain('title="Missing scores"');
    expect(source).toContain("chatRuntime.submit('/missing')");
    expect(source).toContain('room.data.players.length < 2 || roomTransitionPending');
    expect(source).toContain('const roomTransitionPending = roleSwitchPending');
    expect(source).toContain('|| roomState.pendingLeaveTableID !== null');
    expect(source).toContain('|| roomState.pendingStart !== null;');
  });
});
