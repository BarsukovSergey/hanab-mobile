import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { chatRuntime, lobbyRuntime } from '../runtime/application';
import { parseServerTableProposal, tableProposalMatches } from '../protocol/tableProposal';
import { useAppSelector } from '../store/hooks';
import { chatMessageMetadata } from './chatPresentation';
import { ActionButton, EmptyState, Field, Panel, SectionHeading, useHanabTheme } from './designSystem';

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
  const pregameRoom = useAppSelector((state) => state.room.room.kind === 'pregame'
    ? state.room.room : null);
  const authenticatedUserID = useAppSelector((state) => state.session.authenticatedUser?.userID);
  const authenticatedUsername = useAppSelector(
    (state) => state.session.authenticatedUser?.username,
  );
  const pendingUpdate = useAppSelector((state) => state.room.pendingUpdate);
  const trimmed = draft.trim();

  const send = () => {
    if (chatRuntime.submit(draft)) setDraft('');
  };

  useEffect(() => {
    historyRef.current?.scrollToEnd({ animated: false });
  }, [messages.length, room]);

  return (
    <Panel>
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
          const metadata = chatMessageMetadata(message, authenticatedUsername);
          const proposal = parseServerTableProposal({ server: message.server, msg: message.rawMsg });
          const isOwnerInThisTable = pregameRoom !== null
            && room === `table${pregameRoom.tableID}`
            && authenticatedUserID === pregameRoom.data.owner;
          const alreadyApplied = proposal !== null && pregameRoom !== null
            && tableProposalMatches(proposal, pregameRoom.data);
          const canApplyProposal = proposal !== null && isOwnerInThisTable
            && pendingUpdate === null && !alreadyApplied;
          return (
            <View key={`${message.datetime}-${index}`} style={styles.messageRow}>
              <Text style={[styles.message, { color: theme.colors.text }]}>
                <Text style={[styles.meta, { color: theme.colors.textMuted }]}>
                  {time.length > 0 ? `${time} ` : ''}{metadata} </Text>
                {message.msg}
              </Text>
              {proposal !== null && isOwnerInThisTable && (
                <ActionButton
                  compact
                  disabled={!canApplyProposal}
                  title={alreadyApplied ? 'Already applied' : 'Apply proposal'}
                  onPress={() => {
                    if (canApplyProposal) {
                      lobbyRuntime.updateTable(proposal.name, proposal.maxPlayers, proposal.options);
                    }
                  }}
                />
              )}
            </View>
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
  messageRow: { gap: 6 },
  message: { fontSize: 14, lineHeight: 20 },
  meta: { fontWeight: '800' },
  input: { minHeight: 72, textAlignVertical: 'top' },
  footer: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  counter: { fontSize: 11 },
});
