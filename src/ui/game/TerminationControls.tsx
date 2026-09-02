import { Alert, Button, View } from 'react-native';

import { terminationRuntime } from '../../runtime/application';
import { useAppSelector } from '../../store/hooks';

export function TerminationControls() {
  const sessionPhase = useAppSelector((state) => state.session.phase);
  const connectionEpoch = useAppSelector((state) => state.session.connectionEpoch);
  const room = useAppSelector((state) => state.room.room);
  const vote = useAppSelector((state) => state.termination.vote);

  if (
    sessionPhase !== 'ready'
    || room.kind !== 'live_game'
    || room.role !== 'player'
    || room.sharedReplay
    || room.clientState.finished
    || room.clientState.replay.active
    || room.clientState.ongoingGame.turn.currentPlayerIndex === null
  ) return null;

  const ourVote = vote !== null
    && vote.connectionEpoch === connectionEpoch
    && vote.tableID === room.tableID
    && vote.gameLoadEpoch === room.gameLoadEpoch
    ? vote.value
    : false;

  return (
    <View>
      <Button
        title={ourVote ? 'Cancel termination vote' : 'Vote to terminate'}
        onPress={() => terminationRuntime.voteForTermination()}
      />
      <Button
        title="Terminate game"
        onPress={() => Alert.alert(
          'Terminate game?',
          'This immediately ends the game for everyone.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Terminate',
              style: 'destructive',
              onPress: () => { terminationRuntime.terminateGame(); },
            },
          ],
        )}
      />
    </View>
  );
}
