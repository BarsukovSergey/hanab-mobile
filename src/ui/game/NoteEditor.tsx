import { useEffect, useMemo, useState } from 'react';
import { Keyboard, Modal, StyleSheet, Text, View } from 'react-native';

import { composeQuickNote, type QuickNoteToken } from '../../game/selectors/noteComposition';
import { ActionButton, Field, useHanabTheme } from '../designSystem';
import { normalizeSubmittedNote } from './noteEditing';

const QUICK_TOKENS: readonly { label: string; token: QuickNoteToken }[] = [
  { label: 'F', token: 'f' },
  { label: 'CM', token: 'cm' },
  { label: 'PTD', token: 'ptd' },
  { label: 'KT', token: 'kt' },
  { label: 'Fix', token: 'fix' },
  { label: '?', token: '?' },
  { label: '!', token: '!' },
];

export function NoteEditor({
  title,
  value,
  variantName,
  editable,
  visible,
  onChange,
  onSave,
  onClear,
  onClose,
}: {
  title: string;
  value: string;
  variantName: string;
  editable: boolean;
  visible: boolean;
  onChange: (value: string) => void;
  onSave: (value: string) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const { theme } = useHanabTheme();
  const [editing, setEditing] = useState(false);
  const quickCandidates = useMemo(() => new Map(QUICK_TOKENS.map(({ token }) => [
    token,
    composeQuickNote(variantName, value, token),
  ])), [value, variantName]);

  useEffect(() => {
    if (!visible) setEditing(false);
  }, [visible]);

  const submitValue = (nextValue: string) => onSave(normalizeSubmittedNote(nextValue));
  const submit = () => submitValue(value);
  const change = (nextValue: string) => {
    if (nextValue.includes('\n') || nextValue.includes('\r')) {
      submitValue(nextValue.replace(/[\r\n]+/g, ''));
      return;
    }
    onChange(nextValue);
  };
  const requestClose = () => {
    if (editing) {
      Keyboard.dismiss();
      setEditing(false);
      return;
    }
    onClose();
  };

  return <Modal animationType="slide" onRequestClose={requestClose} statusBarTranslucent transparent visible={visible}>
    <View style={styles.backdrop}>
      <View style={[styles.sheet, { backgroundColor: theme.colors.surfaceRaised, borderColor: theme.colors.borderStrong }]}>
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={[styles.eyebrow, { color: theme.colors.textMuted }]}>CARD NOTE</Text>
            <Text numberOfLines={2} style={[styles.title, { color: theme.colors.text }]}>{title}</Text>
          </View>
          <ActionButton compact title="Close" tone="ghost" onPress={requestClose} />
        </View>
        <Field
          autoFocus={editing}
          blurOnSubmit={editing}
          editable={editing}
          enterKeyHint={editing ? 'done' : undefined}
          maxLength={editing ? 300 : undefined}
          multiline={!editing}
          onChangeText={editing ? change : undefined}
          onSubmitEditing={editing ? submit : undefined}
          placeholder={editing ? 'Add a private note' : 'No saved note on this card'}
          returnKeyType={editing ? 'done' : undefined}
          style={[styles.input, !editing && styles.readOnlyInput]}
          submitBehavior={editing ? 'blurAndSubmit' : 'newline'}
          value={value}
        />
        {editable && !editing && <View style={styles.actions}>
          <ActionButton title="Edit" tone="primary" onPress={() => setEditing(true)} />
        </View>}
        {editable && editing && <>
          <View style={styles.quickActions}>
            {QUICK_TOKENS.map(({ label, token }) => {
              const candidate = quickCandidates.get(token) ?? null;
              return <ActionButton
                compact
                disabled={candidate === null || candidate === value}
                key={token}
                title={label}
                tone="ghost"
                onPress={() => {
                  if (candidate !== null) onChange(candidate);
                }}
              />;
            })}
          </View>
          <Text style={[styles.quickHint, { color: theme.colors.textMuted }]}>Quick tags update the draft only. Unsupported syntax stays manual.</Text>
          <View style={styles.actions}>
            <ActionButton title="Save" tone="primary" onPress={submit} />
            <ActionButton disabled={value.length === 0} title="Clear" onPress={onClear} />
            <ActionButton title="Done editing" tone="ghost" onPress={() => {
              Keyboard.dismiss();
              setEditing(false);
            }} />
          </View>
        </>}
      </View>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: 'rgba(0, 0, 0, 0.58)', flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, gap: 12, padding: 14, paddingBottom: 20 },
  header: { alignItems: 'center', flexDirection: 'row', gap: 10, justifyContent: 'space-between' },
  headerCopy: { flex: 1, minWidth: 0 },
  eyebrow: { fontSize: 9, fontWeight: '900', letterSpacing: 0.9 },
  title: { fontSize: 17, fontWeight: '900' },
  input: { minHeight: 44 },
  readOnlyInput: { minHeight: 88, textAlignVertical: 'top' },
  quickActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  quickHint: { fontSize: 10, lineHeight: 14 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
