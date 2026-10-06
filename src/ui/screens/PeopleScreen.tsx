import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useAppSelector } from '../../store/hooks';
import { tableSelectors, userSelectors } from '../../store/store';
import { ActionButton, EmptyState, Field, Panel, Pill, SectionHeading, useHanabTheme, useResponsiveLayout } from '../designSystem';
import { getPeopleRows, getPeopleSections } from '../peoplePresentation';

export function PeopleScreen({ onBack, onProfile, roomOccupied, showEmbeddedBack = true }: {
  onBack: () => void;
  onProfile: (username: string) => void;
  roomOccupied: boolean;
  showEmbeddedBack?: boolean;
}) {
  const { theme } = useHanabTheme();
  const { availableWidth, availableHeight } = useResponsiveLayout();
  const wideRows = availableWidth > availableHeight;
  const users = useAppSelector(userSelectors.selectAll);
  const tables = useAppSelector(tableSelectors.selectAll);
  const authenticatedUser = useAppSelector((state) => state.session.authenticatedUser);
  const friends = useAppSelector((state) => state.session.friends);
  const [search, setSearch] = useState('');
  const rows = useMemo(() => getPeopleRows(users, friends, authenticatedUser, tables),
    [authenticatedUser, friends, tables, users]);
  const sections = getPeopleSections(rows, search);

  return <View style={styles.root}>
    <View style={[styles.toolbar, wideRows && styles.wideToolbar]}>
      <SectionHeading title="People" detail={`${rows.length} online`} />
      <Field accessibilityLabel="Search known usernames" autoCapitalize="none" autoCorrect={false}
        placeholder="Search usernames" value={search} onChangeText={setSearch} style={styles.search} />
      {showEmbeddedBack && <ActionButton compact title="Back to Lobby" onPress={onBack} />}
    </View>
    {roomOccupied && rows.some((row) => row.tableAction !== null) &&
      <Text style={{ color: theme.colors.textMuted }}>Return to the current room before spectating another table.</Text>}
    {sections.every((section) => section.rows.length === 0) &&
      <EmptyState>{rows.length === 0 ? 'No users online.' : 'No matching usernames.'}</EmptyState>}
    {sections.filter((section) => section.rows.length > 0).map((section) => <Panel key={section.title}>
      <SectionHeading title={section.title} />
      {section.rows.map((row) => <View key={row.user.userID}
        style={[styles.userRow, wideRows && styles.wideRow, { borderColor: theme.colors.border }]}>
        <View style={[styles.userCopy, wideRows && styles.wideCopy]}>
          <Text style={[styles.username, { color: row.isFriend ? theme.colors.accent : theme.colors.text }]}>{row.user.name}</Text>
          <Text style={{ color: theme.colors.textMuted }}>{row.location}</Text>
        </View>
        <View style={styles.actions}>
          {row.isOwnUser && <Pill>You</Pill>}
          {row.user.inactive && <Pill>Inactive</Pill>}
          <ActionButton compact title="Profile" accessibilityLabel={`Profile for ${row.user.name}`}
            onPress={() => onProfile(row.user.name)} />
        </View>
      </View>)}
    </Panel>)}
  </View>;
}

const styles = StyleSheet.create({
  root: { gap: 12 },
  toolbar: { gap: 8 },
  wideToolbar: { flexDirection: 'row', alignItems: 'center' },
  search: { flexGrow: 1, minWidth: 140 },
  userRow: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, paddingVertical: 6, gap: 8 },
  wideRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  userCopy: { flex: 1, gap: 2, minWidth: 0 },
  wideCopy: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  username: { fontSize: 15, fontWeight: '700' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
});
