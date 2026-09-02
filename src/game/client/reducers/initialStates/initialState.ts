import { newArray } from 'complete-common';

import { getVariant } from '../../../upstream/gameData';
import type { GameMetadata } from '../../../upstream/interfaces/GameMetadata';
import { getInitialGameState } from '../../../upstream/reducers/initialStates/initialGameState';
import { getTotalCardsInDeck } from '../../../upstream/rules/deck';
import type { State } from '../../types/State';

export function initialState(metadata: GameMetadata): State {
  const gameState = getInitialGameState(metadata);

  const { options } = metadata;
  const variant = getVariant(options.variantName);
  const totalCardsInDeck = getTotalCardsInDeck(variant);
  const notesSize = totalCardsInDeck + variant.suits.length + 1;

  return {
    visibleState: null,
    ongoingGame: gameState,
    replay: {
      active: false,
      segment: 0,
      states: [],
      actions: [],

      databaseID: null,
      shared: null,
    },
    notes: {
      ourNotes: newArray(notesSize, {
        possibilities: [],
        chopMoved: false,
        needsFix: false,
        questionMark: false,
        exclamationMark: false,
        knownTrash: false,
        finessed: false,
        discardPermission: false,
        blank: false,
        unclued: false,
        clued: false,
        text: '',
      }),
      allNotes: newArray(notesSize, []),
      efficiencyModifier: 0,
    },
    pause: { active: false, playerIndex: 0, queued: false },

    playing: true,
    shadowing: false,
    finished: false,

    datetimeStarted: null,
    datetimeFinished: null,

    metadata,
    cardIdentities: newArray(totalCardsInDeck, {
      suitIndex: null,
      rank: null,
    }),
    spectators: [],
  };
}
