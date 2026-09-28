import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from '@jest/globals';

const source = readFileSync(resolve(__dirname, 'PregameScreen.tsx'), 'utf8').replace(/\r\n/g, '\n');

describe('pregame native tools', () => {
  test('uses direct max-player buttons instead of a plus-minus stepper', () => {
    expect(source).toContain('const MAX_PLAYER_OPTIONS = [2, 3, 4, 5, 6] as const;');
    expect(source).toContain('MAX_PLAYER_OPTIONS.map((value) => {');
    expect(source).toContain('const selected = editMaxPlayers === value;');
    expect(source).toContain('accessibilityState={{ selected }}');
    expect(source).toContain('onPress={() => setEditMaxPlayers(value)}');
    expect(source).not.toContain('styles.stepperRow');
    expect(source).not.toContain('title="−"');
    expect(source).not.toContain('title="+"');
  });

  test('confirms owner kicks and sends through chat only after confirmation', () => {
    expect(source).toContain('import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from \'react-native\'');
    expect(source).toContain('{isOwner && <ActionButton compact disabled={roomTransitionPending} title="Kick"');
    expect(source).toContain('{!player.you && <UserContextActions');
    expect(source).toContain('Alert.alert(');
    expect(source).toContain("{ text: 'Cancel', style: 'cancel' }");
    expect(source).toContain('style: \'destructive\'');
    expect(source).toContain('onPress: () => { chatRuntime.submit(`/kick ${player.name}`); }');
    expect(source).toContain('{ cancelable: false }');
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
