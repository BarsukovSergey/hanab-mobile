import { Pressable, StyleSheet, Text, View } from 'react-native';

import { freeBotSlots, isBotAtTable, isBotOnline, knownBots } from '../config/knownBots';
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
  return (
    <View style={styles.root}>
      <Text style={{ color: theme.colors.textMuted }}>Bots selected: {selected.length}/{capacity}</Text>
      {knownBots.map((bot) => {
        const online = isBotOnline(bot.username, users);
        const present = isBotAtTable(bot.username, players);
        const checked = selected.some((name) => name.toLowerCase() === bot.username.toLowerCase());
        const unsupported = protectedTable && !bot.passwordJoin;
        const disabled = !online || present || unsupported || (!checked && selected.length >= capacity);
        return (
          <Pressable key={bot.username} accessibilityRole="checkbox"
            accessibilityState={{ checked, disabled }} disabled={disabled}
            onPress={() => onChange(checked
              ? selected.filter((name) => name.toLowerCase() !== bot.username.toLowerCase())
              : [...selected, bot.username])}
            style={[styles.row, { borderColor: theme.colors.border, opacity: disabled ? 0.5 : 1 }]}>
            <Text style={{ color: theme.colors.text }}>{checked ? '☑' : '☐'} {bot.username}</Text>
            <Text style={{ color: theme.colors.textMuted }}>
              {present ? 'At table' : unsupported ? 'Unavailable for private tables' : online ? 'Online' : 'Offline'}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 4 },
  row: { borderBottomWidth: 1, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8, paddingVertical: 8 },
});
