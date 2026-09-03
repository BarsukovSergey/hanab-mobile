import { useState } from 'react';
import { Button, Text, TextInput, View } from 'react-native';

import type { MobileTableOptions } from '../../protocol/lobbyProtocol';
import {
  isJoinEligible,
  isPregameSpectateEligible,
  isReattendEligible,
  isSpectateEligible,
} from '../../runtime/LobbyRuntime';
import { lobbyRuntime } from '../../runtime/application';
import { useAppSelector } from '../../store/hooks';
import { tableSelectors } from '../../store/store';
import { ChatPanel } from '../ChatPanel';
import { shellStyles } from '../shellStyles';
import { TableOptionsEditor } from '../TableOptionsEditor';

const DEFAULT_OPTIONS: MobileTableOptions = {
  variantName: 'No Variant', timed: false, timeBase: 0, timePerTurn: 0,
  cardCycle: false, emptyClues: false,
  oneExtraCard: false, oneLessCard: false, allOrNothing: false,
};

export function LobbyScreen({ onOpenHistory }: { onOpenHistory: () => void }) {
  const [tableName, setTableName] = useState('');
  const [tablePassword, setTablePassword] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(5);
  const [createOptions, setCreateOptions] = useState<MobileTableOptions>(DEFAULT_OPTIONS);
  const [joinPassword, setJoinPassword] = useState('');
  const [joinPasswordTableID, setJoinPasswordTableID] = useState<number | null>(null);
  const tables = useAppSelector(tableSelectors.selectAll);
  const roomState = useAppSelector((state) => state.room);
  const spectateTables = tables.filter(isSpectateEligible);
  const joinTables = tables.filter((table) => isJoinEligible(table) || isPregameSpectateEligible(table));
  const reattendTables = tables.filter(isReattendEligible);
  const attendancePending = roomState.pendingSpectateTableID !== null
    || roomState.pendingRecovery !== null
    || roomState.pendingJoin !== null
    || roomState.pendingCreate !== null;

  return (<>
    <View style={shellStyles.section}>
      <Text style={shellStyles.heading}>Lobby</Text>
      <Text>{tables.length} tables available</Text>
      <Button title="Game History" onPress={onOpenHistory} />
    </View>
    <View style={shellStyles.section}>
      <Text style={shellStyles.heading}>Create table</Text>
      <TextInput maxLength={45} onChangeText={setTableName} placeholder="Table name"
        style={shellStyles.input} value={tableName} />
      <TextInput autoCapitalize="none" autoCorrect={false} onChangeText={setTablePassword}
        placeholder="Table password (optional)" secureTextEntry style={shellStyles.input}
        value={tablePassword} />
      <Text>Max players: {maxPlayers}</Text>
      <View style={shellStyles.buttonRow}>
        <Button disabled={maxPlayers <= 2} title="−" onPress={() => setMaxPlayers((n) => n - 1)} />
        <Button disabled={maxPlayers >= 6} title="+" onPress={() => setMaxPlayers((n) => n + 1)} />
      </View>
      <TableOptionsEditor options={createOptions} onChange={setCreateOptions} />
      <Button disabled={attendancePending || tableName.trim().length === 0}
        title={roomState.pendingCreate === null ? 'Create' : 'Creating...'}
        onPress={() => {
          if (lobbyRuntime.createTable(tableName, maxPlayers, createOptions, tablePassword)) {
            setTablePassword('');
          }
        }} />
    </View>
    <View style={shellStyles.section}>
      <Text style={shellStyles.heading}>Your running game</Text>
      {reattendTables.length === 0 && <Text>No game to resume.</Text>}
      {reattendTables.map((table) => (
        <View style={shellStyles.tableRow} key={table.id}>
          <Text style={shellStyles.tableName}>{table.name}</Text>
          <Text>{table.variant} · {table.numPlayers}/{table.maxPlayers}</Text>
          <Button disabled={attendancePending} title="Return to game"
            onPress={() => lobbyRuntime.reattend(table.id)} />
        </View>
      ))}
    </View>
    <View style={shellStyles.section}>
      <Text style={shellStyles.heading}>Running tables</Text>
      {spectateTables.length === 0 && <Text>No running tables.</Text>}
      {spectateTables.map((table) => (
        <View style={shellStyles.tableRow} key={table.id}>
          <Text style={shellStyles.tableName}>{table.name}</Text>
          <Text>{table.variant} · {table.numPlayers}/{table.maxPlayers}</Text>
          <Button disabled={attendancePending} title="Spectate"
            onPress={() => lobbyRuntime.spectate(table.id)} />
        </View>
      ))}
    </View>
    <View style={shellStyles.section}>
      <Text style={shellStyles.heading}>Pregame tables</Text>
      {joinTables.length === 0 && <Text>No pregame tables.</Text>}
      {joinTables.map((table) => (
        <View style={shellStyles.tableRow} key={table.id}>
          <Text style={shellStyles.tableName}>{table.name}</Text>
          <Text>{table.variant} · {table.numPlayers}/{table.maxPlayers}</Text>
          {table.passwordProtected && (
            <TextInput autoCapitalize="none" autoCorrect={false}
              onChangeText={(value) => { setJoinPasswordTableID(table.id); setJoinPassword(value); }}
              placeholder="Table password" secureTextEntry style={shellStyles.input}
              value={joinPasswordTableID === table.id ? joinPassword : ''} />
          )}
          {isJoinEligible(table) && (
            <Button disabled={attendancePending} title="Join" onPress={() => {
              const secret = joinPasswordTableID === table.id ? joinPassword : undefined;
              if (lobbyRuntime.join(table.id, secret)) {
                setJoinPassword('');
                setJoinPasswordTableID(null);
              }
            }} />
          )}
          {isPregameSpectateEligible(table) && (
            <Button disabled={attendancePending} title="Spectate pregame"
              onPress={() => lobbyRuntime.spectate(table.id)} />
          )}
        </View>
      ))}
    </View>
    <ChatPanel room="lobby" title="Lobby chat" />
  </>);
}
