import type { GameMetadata } from '../upstream/interfaces/GameMetadata';
import type { GameState } from '../upstream/interfaces/GameState';

export type AuthoritativeGame = {
  metadata: GameMetadata;
  game: GameState;
};

export type { GameMetadata, GameState };
