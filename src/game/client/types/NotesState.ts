import type { CardNote } from '../../upstream/interfaces/CardNote';
import type { SpectatorNote } from '../../upstream/interfaces/SpectatorNote';

export interface NotesState {
  readonly ourNotes: readonly CardNote[];
  readonly allNotes: ReadonlyArray<readonly SpectatorNote[]>;
  readonly efficiencyModifier: number;
}
