import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { chatRuntime, lobbyRuntime } from '../../runtime/application';
import { useAppSelector } from '../../store/hooks';
import { tableSelectors, userSelectors } from '../../store/store';
import {
  ActionButton,
  EmptyState,
  Field,
  Panel,
  Pill,
  SectionHeading,
  useHanabTheme,
} from '../designSystem';
import { getPeopleRows } from '../peoplePresentation';

export function PeopleScreen({ onBack }: { onBack: () => void }) {
  const { theme } = useHanabTheme();
  const users = useAppSelector(userSelectors.selectAll);
  const tables = useAppSelector(tableSelectors.selectAll);
  const authenticatedUser = useAppSelector((state) => state.session.authenticatedUser);
  const friends = useAppSelector((state) => state.session.friends);
  const [composerUserID, setComposerUserID] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const rows = useMemo(
    () => getPeopleRows(users, friends, authenticatedUser, tables),
    [authenticatedUser, friends, tables, users],
  );

  const closeComposer = () => {
    setComposerUserID(null);
    setMessage('');
  };

  return (
    <View style={styles.root}>
      <Panel style={styles.hero}>
        <SectionHeading
          title="People"
          detail={`${rows.length} ${rows.length === 1 ? 'person' : 'people'} online`}
        />
        <ActionButton compact title="Back to Lobby" onPress={onBack} />
      </Panel>

      <Panel>
        {rows.length === 0 && <EmptyState>No users online.</EmptyState>}
        {rows.map((row) => {
          const composing = composerUserID === row.user.userID;
          const tableAction = row.tableAction;
          return (
            <View key={row.user.userID} style={[styles.userRow, { borderColor: theme.colors.border }]}>
              <View style={styles.userHeader}>
                <View style={styles.userCopy}>
                  <Text style={[styles.username, { color: theme.colors.text }]}>{row.user.name}</Text>
                  <Text style={[styles.location, { color: theme.colors.textMuted }]}>{row.location}</Text>
                </View>
                <View style={styles.indicators}>
                  {row.isOwnUser && <Pill>You</Pill>}
                  {row.isFriend && <Pill>Friend</Pill>}
                  {row.user.inactive && <Pill>Inactive</Pill>}
                  {row.user.hyphenated && <Pill>H-group</Pill>}
                </View>
              </View>

              {row.canUseContextActions && (
                <View style={styles.actions}>
                  <ActionButton
                    compact
                    title="Message"
                    onPress={() => {
                      setComposerUserID(row.user.userID);
                      setMessage('');
                    }}
                  />
                  <ActionButton
                    compact
                    title={row.isFriend ? 'Unfriend' : 'Friend'}
                    onPress={() => chatRuntime.setFriend(row.user.name, !row.isFriend)}
                  />
                  {tableAction !== null && (
                    <ActionButton
                      compact
                      title={tableAction.label}
                      onPress={() => lobbyRuntime.spectate(tableAction.tableID)}
                    />
                  )}
                </View>
              )}

              {composing && row.canUseContextActions && (
                <View style={styles.composer}>
                  <Field
                    autoCapitalize="sentences"
                    maxLength={300}
                    multiline
                    onChangeText={setMessage}
                    placeholder={`Message ${row.user.name}`}
                    value={message}
                  />
                  <View style={styles.actions}>
                    <ActionButton
                      compact
                      disabled={message.trim().length === 0}
                      title="Send"
                      tone="primary"
                      onPress={() => {
                        if (chatRuntime.sendPrivateMessage(row.user.name, message)) closeComposer();
                      }}
                    />
                    <ActionButton compact title="Cancel" tone="ghost" onPress={closeComposer} />
                  </View>
                </View>
              )}
            </View>
          );
        })}
      </Panel>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 16 },
  hero: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  userRow: { borderTopWidth: 1, gap: 10, paddingTop: 12 },
  userHeader: { alignItems: 'flex-start', flexDirection: 'row', gap: 10, justifyContent: 'space-between' },
  userCopy: { flex: 1, gap: 2, minWidth: 0 },
  username: { fontSize: 16, fontWeight: '800' },
  location: { fontSize: 13, lineHeight: 18 },
  indicators: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, justifyContent: 'flex-end' },
  actions: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  composer: { gap: 8 },
});
