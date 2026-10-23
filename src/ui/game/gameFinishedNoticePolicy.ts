import type { RoomState } from '../../store/roomSlice';

export type FinishObservation = {
  owner: string; finished: boolean; eligibleLive: boolean;
  ready: boolean; visible: boolean; appActive: boolean;
};
export type FinishMemory = { owner: string; sawActive: boolean; consumed: boolean };

/** Presentation observation only. A new lifetime seeds authority and never announces hydration. */
export function observeGameFinish(previous: FinishMemory | null, observation: FinishObservation) {
  const present = observation.ready && observation.visible && observation.appActive;
  if (previous === null || previous.owner !== observation.owner) return {
    memory: { owner: observation.owner, sawActive: present && observation.eligibleLive && !observation.finished,
      consumed: observation.finished }, show: false,
  };
  const show = present && observation.finished && previous.sawActive && !previous.consumed;
  return {
    memory: { owner: observation.owner,
      sawActive: present && (previous.sawActive || observation.eligibleLive && !observation.finished),
      consumed: previous.consumed || observation.finished }, show,
  };
}

const END_CONDITIONS: Record<number, string> = {
  0: 'In progress', 1: 'Normal completion', 2: 'Strikeout', 3: 'Timeout',
  4: 'Terminated by player', 5: 'Speedrun failed', 6: 'Idle timeout',
  7: 'Character softlock', 8: 'All or Nothing failed',
  9: 'All or Nothing softlock', 10: 'Terminated by vote',
};

export function getGameFinishedResult(room: Extract<RoomState, { kind: 'live_game' }>) {
  const gameOver = [...room.clientState.replay.actions].reverse().find((action) => action.type === 'gameOver');
  const condition = room.gameHistory?.endCondition ?? (gameOver?.type === 'gameOver' ? gameOver.endCondition : null);
  return {
    score: room.clientState.ongoingGame.score,
    maxScore: room.clientState.ongoingGame.stats.maxScore,
    reason: condition === null || condition === 0 ? 'Completion reason unavailable' : END_CONDITIONS[condition] ?? `End condition ${condition}`,
  };
}
