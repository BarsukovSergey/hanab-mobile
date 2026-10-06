import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { chatRuntime } from '../runtime/application';
import { ActionButton } from './designSystem';

type UserContextActionsProps = {
  username: string;
  isFriend: boolean;
  room?: string;
  onMessage: () => void;
  children?: ReactNode;
};

export function UserContextActions({ username, isFriend, room = 'lobby', onMessage, children }: UserContextActionsProps) {
  return <View style={styles.actions}>
    <ActionButton compact title="Message" onPress={onMessage} />
    <ActionButton compact title={isFriend ? 'Unfriend' : 'Friend'}
      onPress={() => chatRuntime.setFriend(username, !isFriend, room)} />
    {children}
  </View>;
}

const styles = StyleSheet.create({
  actions: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
