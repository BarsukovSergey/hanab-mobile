import { useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { chatRuntime } from '../runtime/application';
import { useAppSelector } from '../store/hooks';
import { sessionPrivateMessages } from './chatPresentation';
import { ActionButton, EmptyState, Field, useHanabTheme } from './designSystem';

type UserContextActionsProps = {
  username: string;
  isFriend: boolean;
  room?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: ReactNode;
};

export function UserContextActions({
  username,
  isFriend,
  room = 'lobby',
  open,
  onOpenChange,
  children,
}: UserContextActionsProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [message, setMessage] = useState('');
  const { theme } = useHanabTheme();
  const messagesByRoom = useAppSelector((state) => state.chat.messagesByRoom);
  const authenticatedUsername = useAppSelector((state) => state.session.authenticatedUser?.username);
  const transcript = sessionPrivateMessages(messagesByRoom, authenticatedUsername, username);
  const composing = open ?? internalOpen;
  const setComposing = (nextOpen: boolean) => {
    setInternalOpen(nextOpen);
    onOpenChange?.(nextOpen);
  };
  const closeComposer = () => {
    setComposing(false);
    setMessage('');
  };

  return (
    <View style={styles.root}>
      <View style={styles.actions}>
        <ActionButton compact title="Dialog" onPress={() => {
          setMessage('');
          setComposing(true);
        }} />
        <ActionButton
          compact
          title={isFriend ? 'Unfriend' : 'Friend'}
          onPress={() => chatRuntime.setFriend(username, !isFriend, room)}
        />
        {children}
      </View>
      {composing && (
        <View style={styles.composer}>
          <ScrollView style={[styles.transcript, { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.border }]}>
            {transcript.length === 0 ? <EmptyState>No messages yet.</EmptyState> : transcript.map((entry, index) => {
              const outgoing = authenticatedUsername !== undefined
                && entry.who.toLocaleLowerCase() === authenticatedUsername.toLocaleLowerCase();
              return <View key={`${entry.datetime}-${index}`} style={styles.transcriptMessage}>
                <Text style={{ color: theme.colors.text, fontWeight: '700' }}>
                  {outgoing ? `To ${entry.recipient}` : `From ${entry.who}`}
                </Text>
                <Text style={{ color: theme.colors.text }}>{entry.msg}</Text>
                <Text style={{ color: theme.colors.textMuted, fontSize: 11 }}>{entry.datetime}</Text>
              </View>;
            })}
          </ScrollView>
          <Field
            autoCapitalize="sentences"
            maxLength={300}
            multiline
            onChangeText={setMessage}
            placeholder={`Message ${username}`}
            style={styles.messageField}
            value={message}
          />
          <View style={styles.actions}>
            <ActionButton
              compact
              disabled={message.trim().length === 0}
              title="Send"
              tone="primary"
              onPress={() => {
                if (chatRuntime.sendPrivateMessage(username, message, room)) setMessage('');
              }}
            />
            <ActionButton compact title="Cancel" tone="ghost" onPress={closeComposer} />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignSelf: 'stretch', gap: 8, width: '100%' },
  actions: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  composer: { alignSelf: 'stretch', gap: 8, width: '100%' },
  transcript: { alignSelf: 'stretch', borderRadius: 8, borderWidth: 1, maxHeight: 240, padding: 8, width: '100%' },
  messageField: { alignSelf: 'stretch', width: '100%' },
  transcriptMessage: { gap: 2, paddingVertical: 6 },
});
