import { Button, Text, View } from 'react-native';

import { areTableOptionsSupported } from '../../game/client/supportedVariants';
import { lobbyRuntime } from '../../runtime/application';
import { useAppSelector } from '../../store/hooks';
import { shellStyles } from '../shellStyles';

const END_CONDITIONS = [
  'In progress', 'Normal', 'Strikeout', 'Timeout', 'Terminated by player',
  'Speedrun failed', 'Idle timeout', 'Character softlock',
  'All or Nothing failed', 'All or Nothing softlock', 'Terminated by vote',
] as const;

export function HistoryScreen({
  onBack,
  onWatchReplay,
}: {
  onBack: () => void;
  onWatchReplay: (databaseID: number) => void;
}) {
  const history = useAppSelector((state) => state.history);
  const replayPending = history.pendingReplayCreate !== null;
  return (
    <View style={shellStyles.section}>
      <View style={shellStyles.titleRow}>
        <Text style={shellStyles.heading}>Game History</Text>
        <Button title="Back to Lobby" onPress={onBack} />
      </View>
      {!history.initialPageReceived && <Text>Loading game history...</Text>}
      {history.error !== null && <Text style={shellStyles.error}>{history.error}</Text>}
      {history.initialPageReceived && history.items.length === 0 && (
        <Text>No finished games yet.</Text>
      )}
      {history.items.map((item) => {
        const supported = areTableOptionsSupported(item.options);
        const finished = new Date(item.datetimeFinished);
        const finishedLabel = Number.isNaN(finished.getTime())
          ? item.datetimeFinished
          : finished.toLocaleString();
        return (
          <View style={shellStyles.tableRow} key={item.id}>
            <Text style={shellStyles.tableName}>Game #{item.id} · {item.options.variantName}</Text>
            <Text>{item.playerNames.join(', ')}</Text>
            <Text>{finishedLabel}</Text>
            <Text>Score: {item.score} · {END_CONDITIONS[item.endCondition]}</Text>
            {!supported && <Text>This game uses unsupported options.</Text>}
            <Button disabled={!supported || replayPending}
              title={replayPending ? 'Opening replay...' : 'Watch Replay'}
              onPress={() => onWatchReplay(item.id)} />
          </View>
        );
      })}
      {history.hasMore && (
        <Button disabled={history.pendingRequest !== null}
          title={history.pendingRequest === null ? 'Load More' : 'Loading more...'}
          onPress={() => lobbyRuntime.loadMoreHistory()} />
      )}
      {history.pendingRequest !== null && <Text>Loading another page...</Text>}
    </View>
  );
}
