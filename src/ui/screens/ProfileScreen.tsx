import { Text, View } from 'react-native';

import { lobbyRuntime } from '../../runtime/application';
import { useAppSelector } from '../../store/hooks';
import { tableSelectors, userSelectors } from '../../store/store';
import { ActionButton, Panel, Pill, SectionHeading, useHanabTheme } from '../designSystem';
import { getProfilePresentation } from '../profilePresentation';
import { UserContextActions } from '../UserContextActions';

export function ProfileScreen({ username, roomOccupied, room = 'lobby', onMessage }: {
  username: string;
  onMessage: () => void;
  roomOccupied: boolean;
  room?: string;
}) {
  const { theme } = useHanabTheme();
  const users = useAppSelector(userSelectors.selectAll);
  const tables = useAppSelector(tableSelectors.selectAll);
  const friends = useAppSelector((state) => state.session.friends);
  const authenticatedUser = useAppSelector((state) => state.session.authenticatedUser);
  const profile = getProfilePresentation(username, users, friends, authenticatedUser, tables);
  const tableAction = profile.tableAction;
  return <Panel>
    <SectionHeading title={profile.username} detail={profile.presence} />
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      {profile.isOwnUser && <Pill>You</Pill>}
      {!profile.isOwnUser && <Pill>{profile.isFriend ? 'Friend' : 'Not a friend'}</Pill>}
    </View>
    {profile.location !== null && <Text style={{ color: theme.colors.textMuted }}>{profile.location}</Text>}
    {!profile.isOwnUser && <UserContextActions key={profile.username} username={profile.username}
      isFriend={profile.isFriend} room={room} onMessage={onMessage}>
      {tableAction !== null && <ActionButton compact title={tableAction.label} disabled={roomOccupied}
        onPress={() => {
          if (roomOccupied) return;
          lobbyRuntime.spectate(tableAction.tableID);
        }} />}
    </UserContextActions>}
    {roomOccupied && tableAction !== null &&
      <Text style={{ color: theme.colors.textMuted }}>Return to the current room before spectating another table.</Text>}
  </Panel>;
}
