import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { chatRuntime } from '../runtime/application';
import { ActionButton, Field } from './designSystem';

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
        <ActionButton compact title="Message" onPress={() => {
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
          <Field
            autoCapitalize="sentences"
            maxLength={300}
            multiline
            onChangeText={setMessage}
            placeholder={`Message ${username}`}
            value={message}
          />
          <View style={styles.actions}>
            <ActionButton
              compact
              disabled={message.trim().length === 0}
              title="Send"
              tone="primary"
              onPress={() => {
                if (chatRuntime.sendPrivateMessage(username, message, room)) closeComposer();
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
  root: { gap: 8 },
  actions: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  composer: { gap: 8 },
});
