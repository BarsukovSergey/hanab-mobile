import { useEffect, useState } from 'react';
import { Button, Text, TextInput, View } from 'react-native';

import type { MobileTableOptions } from '../../protocol/lobbyProtocol';
import { lobbyRuntime } from '../../runtime/application';
import { useAppSelector } from '../../store/hooks';
import { ChatPanel } from '../ChatPanel';
import { shellStyles } from '../shellStyles';
import { TableOptionsEditor } from '../TableOptionsEditor';

export function PregameScreen() {
  const session = useAppSelector((state) => state.session);
  const roomState = useAppSelector((state) => state.room);
  const room = roomState.room.kind === 'pregame' ? roomState.room : null;
  const [editName, setEditName] = useState('');
  const [editMaxPlayers, setEditMaxPlayers] = useState(5);
  const [editOptions, setEditOptions] = useState<MobileTableOptions>({
    variantName: 'No Variant', timed: false, timeBase: 0, timePerTurn: 0,
    cardCycle: false, emptyClues: false, oneExtraCard: false, oneLessCard: false,
    allOrNothing: false,
  });

  useEffect(() => {
    if (room === null) return;
    setEditName(room.data.name);
    setEditMaxPlayers(room.data.maxPlayers);
    setEditOptions({
      variantName: room.data.options.variantName,
      timed: room.data.options.timed,
      timeBase: room.data.options.timeBase,
      timePerTurn: room.data.options.timePerTurn,
      cardCycle: room.data.options.cardCycle,
      emptyClues: room.data.options.emptyClues,
      oneExtraCard: room.data.options.oneExtraCard,
      oneLessCard: room.data.options.oneLessCard,
      allOrNothing: room.data.options.allOrNothing,
    });
  }, [room?.data]);

  if (room === null) return null;
  const isOwner = room.role === 'player' && session.authenticatedUser?.userID === room.data.owner;
  return (
    <View style={shellStyles.section}>
      <Text style={shellStyles.heading}>{room.data.name}</Text>
      <Text>{room.data.options.variantName}</Text>
      <Text>{room.role === 'spectator' ? 'Spectating pregame' : 'Joined as player'}</Text>
      <Text>{room.data.players.length}/{room.data.maxPlayers} players</Text>
      {room.data.players.map((player) => (
        <Text key={player.index}>{player.name}{player.you ? ' (you)' : ''}{player.present ? '' : ' (away)'}</Text>
      ))}
      {isOwner && (<>
        <View style={shellStyles.subsection}>
          <Text style={shellStyles.heading}>Edit table</Text>
          <TextInput maxLength={45} onChangeText={setEditName} placeholder="Table name"
            style={shellStyles.input} value={editName} />
          <Text>Max players: {editMaxPlayers}</Text>
          <View style={shellStyles.buttonRow}>
            <Button disabled={editMaxPlayers <= 2} title="−"
              onPress={() => setEditMaxPlayers((count) => count - 1)} />
            <Button disabled={editMaxPlayers >= 6} title="+"
              onPress={() => setEditMaxPlayers((count) => count + 1)} />
          </View>
          <TableOptionsEditor options={editOptions} onChange={setEditOptions} />
          <Button disabled={roomState.pendingUpdate !== null || editName.trim().length === 0}
            title={roomState.pendingUpdate === null ? 'Apply changes' : 'Applying...'}
            onPress={() => lobbyRuntime.updateTable(editName, editMaxPlayers, editOptions)} />
        </View>
        <Text style={shellStyles.heading}>Transfer leader</Text>
        {room.data.players.filter((player) => !player.you).map((player) => (
          <Button key={`leader-${player.name}`} disabled={roomState.pendingLeaderName !== null}
            title={roomState.pendingLeaderName === player.name
              ? `Transferring to ${player.name}...` : `Make ${player.name} leader`}
            onPress={() => lobbyRuntime.setTableLeader(player.name)} />
        ))}
        <Button disabled={room.data.players.length < 2
            || roomState.pendingStart !== null || roomState.pendingLeaveTableID !== null}
          title={roomState.pendingStart === null ? 'Start' : 'Starting...'}
          onPress={() => lobbyRuntime.startGame()} />
      </>)}
      <Button disabled={roomState.pendingLeaveTableID !== null || roomState.pendingStart !== null}
        title={roomState.pendingLeaveTableID === null ? 'Leave' : 'Leaving...'}
        onPress={() => lobbyRuntime.leave(room.tableID)} />
      <ChatPanel room={`table${room.tableID}`} title="Pre-game chat" />
    </View>
  );
}
