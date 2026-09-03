import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { lobbyRuntime } from '../runtime/application';
import { useAppSelector } from '../store/hooks';
import { ActionButton, EmptyState, Field, Panel, SectionHeading, useHanabTheme } from './designSystem';
import { TerminationControls } from './game/TerminationControls';

type Props = {
  room: string;
  title: string;
};

const EMPTY_MESSAGES: readonly never[] = [];

export function ChatPanel({ room, title }: Props) {
  const { theme } = useHanabTheme();
  const [draft, setDraft] = useState('');
  const historyRef = useRef<ScrollView>(null);
  const ready = useAppSelector((state) => state.session.phase === 'ready');
  const messages = useAppSelector((state) => state.chat.messagesByRoom[room] ?? EMPTY_MESSAGES);
  const trimmed = draft.trim();

  const send = () => {
    if (lobbyRuntime.sendChat(draft)) setDraft('');
  };

  useEffect(() => {
    historyRef.current?.scrollToEnd({ animated: false });
  }, [messages.length, room]);

  return (
    <Panel>
      <TerminationControls />
      <SectionHeading title={title} detail={ready ? 'Connected' : 'Chat reconnecting…'} />
      <ScrollView
        contentContainerStyle={styles.historyContent}
        nestedScrollEnabled
        ref={historyRef}
        style={[styles.history, { backgroundColor: theme.colors.surfaceMuted }]}
      >
        {messages.length === 0 && <EmptyState>No messages yet.</EmptyState>}
        {messages.map((message, index) => {
          const date = new Date(message.datetime);
          const time = Number.isNaN(date.getTime())
            ? ''
            : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const author = message.server ? 'Server' : message.who ?? 'Hanab';
          return (
            <Text key={`${message.datetime}-${index}`} style={[styles.message, { color: theme.colors.text }]}>
              <Text style={[styles.meta, { color: theme.colors.textMuted }]}>
                {time.length > 0 ? `${time} ` : ''}{author}: </Text>
              {message.msg}
            </Text>
          );
        })}
      </ScrollView>
      <Field
        editable={ready}
        maxLength={300}
        multiline
        onChangeText={setDraft}
        onSubmitEditing={send}
        placeholder={ready ? 'Message' : 'Chat reconnecting…'}
        style={styles.input}
        value={draft}
      />
      <View style={styles.footer}>
        <Text style={[styles.counter, { color: theme.colors.textMuted }]}>{draft.length}/300</Text>
        <ActionButton compact disabled={!ready || trimmed.length === 0} title="Send" tone="primary" onPress={send} />
      </View>
    </Panel>
  );
}

const styles = StyleSheet.create({
  history: { borderRadius: 10, maxHeight: 260, paddingHorizontal: 10 },
  historyContent: { gap: 7, paddingVertical: 10 },
  message: { fontSize: 14, lineHeight: 20 },
  meta: { fontWeight: '800' },
  input: { minHeight: 72, textAlignVertical: 'top' },
  footer: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  counter: { fontSize: 11 },
});
