import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  freeBotSlots,
  getVisibleBotSections,
  isBotAvailableForTable,
  pruneBotSelection,
} from '../config/knownBots';
import type { LobbyUser } from '../protocol/lobbyProtocol';
import { useHanabTheme } from './designSystem';

export function BotPicker({ selected, onChange, limit, users, players = [], protectedTable = false }: {
  selected: readonly string[];
  onChange: (names: string[]) => void;
  limit: number;
  users: readonly LobbyUser[];
  players?: readonly { name: string }[];
  protectedTable?: boolean;
}) {
  const { theme } = useHanabTheme();
  const capacity = freeBotSlots(limit, 0);
  const { available, busy } = getVisibleBotSections(users, players);

  useEffect(() => {
    const next = pruneBotSelection(selected, users, players, protectedTable, capacity);
    if (next.length !== selected.length || next.some((name, index) => name !== selected[index])) onChange(next);
  }, [selected, users, players, protectedTable, capacity, onChange]);

  const renderBot = ({ bot, user }: (typeof available)[number]) => {
    const checked = selected.some((name) => name.toLowerCase() === bot.username.toLowerCase());
    const eligible = isBotAvailableForTable(user, bot, protectedTable);
    const disabled = !eligible || (!checked && selected.length >= capacity);
    return (
      <Pressable key={bot.username} accessibilityRole="checkbox"
        accessibilityState={{ checked, disabled }} disabled={disabled}
        onPress={() => onChange(checked
          ? selected.filter((name) => name.toLowerCase() !== bot.username.toLowerCase())
          : [...selected, bot.username])}
        style={[styles.row, { borderColor: theme.colors.border, opacity: disabled ? 0.5 : 1 }]}>
        <Text style={{ color: theme.colors.text }}>{checked ? '☑' : '☐'} {bot.username}</Text>
        <Text style={{ color: theme.colors.textMuted }}>
          {user.status !== 0 ? 'Busy' : !eligible ? 'Password join unavailable' : 'Available'}
        </Text>
      </Pressable>
    );
  };
  return (
    <View style={styles.root}>
      <Text style={{ color: theme.colors.textMuted }}>Bots selected: {selected.length}/{capacity}</Text>
      {available.length + busy.length === 0 && <Text style={{ color: theme.colors.textMuted }}>No known bots online.</Text>}
      {available.length > 0 && <Text style={{ color: theme.colors.text }}>Available</Text>}
      {available.map(renderBot)}
      {busy.length > 0 && <Text style={{ color: theme.colors.text }}>Busy</Text>}
      {busy.map(renderBot)}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 4 },
  row: { borderBottomWidth: 1, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8, paddingVertical: 8 },
});
