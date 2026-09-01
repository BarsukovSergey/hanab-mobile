import { useEffect, useRef, useState } from 'react';
import { Button, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { lobbyRuntime } from '../runtime/application';
import { useAppSelector } from '../store/hooks';

type Props = {
  room: string;
  title: string;
};

export function ChatPanel({ room, title }: Props) {
  const [draft, setDraft] = useState('');
  const historyRef = useRef<ScrollView>(null);
  const ready = useAppSelector((state) => state.session.phase === 'ready');
  const messages = useAppSelector((state) => state.chat.messagesByRoom[room] ?? []);
  const trimmed = draft.trim();

  const send = () => {
    if (lobbyRuntime.sendChat(draft)) setDraft('');
  };

  useEffect(() => {
    historyRef.current?.scrollToEnd({ animated: false });
  }, [messages.length, room]);

  return (
    <View style={styles.panel}>
      <Text style={styles.heading}>{title}</Text>
      <ScrollView
        contentContainerStyle={styles.historyContent}
        nestedScrollEnabled
        ref={historyRef}
        style={styles.history}
      >
        {messages.length === 0 && <Text style={styles.empty}>No messages yet.</Text>}
        {messages.map((message, index) => {
          const date = new Date(message.datetime);
          const time = Number.isNaN(date.getTime())
            ? ''
            : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const author = message.server ? 'Server' : message.who ?? 'Hanab';
          return (
            <Text key={`${message.datetime}-${index}`} style={styles.message}>
              <Text style={styles.meta}>{time.length > 0 ? `${time} ` : ''}{author}: </Text>
              {message.msg}
            </Text>
          );
        })}
      </ScrollView>
      <TextInput
        editable={ready}
        maxLength={300}
        multiline
        onChangeText={setDraft}
        onSubmitEditing={send}
        placeholder={ready ? 'Message' : 'Chat reconnecting…'}
        style={styles.input}
        value={draft}
      />
      <View style={styles.send}>
        <Button disabled={!ready || trimmed.length === 0} title="Send" onPress={send} />
      </View>
      <Text style={styles.counter}>{draft.length}/300</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { backgroundColor: '#f3f5f7', borderRadius: 10, gap: 8, padding: 12 },
  heading: { fontSize: 18, fontWeight: '700' },
  history: { maxHeight: 260 },
  historyContent: { gap: 6 },
  empty: { color: '#626b73', fontStyle: 'italic' },
  message: { color: '#202830', lineHeight: 20 },
  meta: { color: '#46515c', fontWeight: '700' },
  input: {
    backgroundColor: '#fff', borderColor: '#aab1b8', borderRadius: 8,
    borderWidth: 1, minHeight: 44, paddingHorizontal: 10, paddingVertical: 8,
  },
  send: { alignSelf: 'flex-end', minWidth: 96 },
  counter: { alignSelf: 'flex-end', color: '#626b73', fontSize: 11 },
});
