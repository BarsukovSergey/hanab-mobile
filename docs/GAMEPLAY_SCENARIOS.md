# Gameplay scenario harness

The scenario harness exists to make gameplay work scenario-driven instead of discovering requirements one bug at a time on a live table.

## Rules

- A scenario must bootstrap through the same `GameBootstrapCoordinator` and pinned upstream reducers as production. Do not hand-write a parallel `GameState` engine for fixtures.
- The developer gallery renders the production `GameScreen` against an isolated scenario Redux store.
- Scenario stores never replace the application singleton store. While the gallery is mounted, authoritative UI commands are suppressed at the application runtime boundary so fixture interactions cannot leak into a real session. Local selection, clue preview, empathy, notes/discard inspection, and authoritative snapshots remain available for deterministic inspection.
- The Gallery entry is exposed only from the `SettingsScreen` that `App.tsx` actually renders, and only under `__DEV__`.
- Canonical viewport dimensions belong to the scenario registry and are exercised through the same pure layout calculations as production. The gallery itself renders on the current device viewport.
- Initial deal sizes are derived through the gameplay selector boundary from pinned upstream `getCardsPerHand`; fixture code must not maintain a parallel player-count hand-size table.
- A gameplay feature is not considered closed merely because one happy-path component test passes. Its scenario should capture the important authoritative state, transient interaction state, responsive geometry, and lifecycle expectations.

## Canonical scenarios

Base and responsive coverage:

- `three-player-base`: ordinary three-player portrait turn with five-card hands.
- `three-player-extra-card`: narrow portrait target with One Extra Card; pinned upstream rules produce six-card hands.
- `six-player-landscape`: dense six-player landscape target with One Extra Card; pinned upstream rules produce four-card hands.

Clue-flow acceptance family:

- `clue-preview-source`: deterministic one-card red clue target for the production local preview flow.
- `clue-committed`: authoritative clue has landed and the server has advanced the turn; the last-clue marker and upstream orange positive-clue border must still be visible.
- `clue-retouched-quacker`: the same card is positively clued again by Cathy with Quacker assigned; the marker must use the actual giver semantics (`Quack`) and render as a retouch.
- `clue-cleanup-after-discard`: the next authoritative discard clears the last-clue marker while the card's accumulated upstream clue knowledge and orange semantic border remain.
- `empty-clue-off`: Gallery-ready zero-touch color clue with Empty Clues disabled; `Give clue` must stay disabled.
- `empty-clue-on`: the same zero-touch fixture with Empty Clues enabled; `Give clue` must be confirmable.

Opponent-note acceptance family:

- `note-edit-source`: an opponent hand card is a valid live note target.
- `note-saved`: the accepted edit updates local note state without entering replay history.
- `note-survives-turn`: the note survives an authoritative turn advance while the card remains in hand.
- `note-card-left-hand`: the noted card is discarded and replaced; stored note knowledge may remain by card order, but the live editor must stop targeting the card immediately.

Table-surface acceptance family:

- `rainbow-table-surface`: `Rainbow (6 Suits)` on a narrow portrait target with an authoritative Rainbow 1 in the sixth firework stack and Red 1 in the discard stack.

Finished/replay Gallery coverage:

- `finished-shared-replay`: runs the authoritative postgame sequence (`gameOver`, `playerTimes`, game history, full card identities, `finishOngoingGame`) and renders the production finished/shared-replay screen without manually completing a live game.

Empathy reuses authoritative clue snapshots rather than duplicating the deal. `clue-committed` gives a deterministic opponent card whose open identity differs from the owner-perspective knowledge shown during empathy.

Reconnect and rotation remain lifecycle acceptance tests over canonical authoritative game construction; they intentionally do not fake a reconnecting socket inside the rendering gallery.

## Clue-flow acceptance contract

The clue family intentionally separates transient interaction from authoritative lifecycle:

1. target + clue choice can be previewed locally from authoritative card identities;
2. committed clue truth comes only from authoritative history;
3. the committed marker is derived from the actual clue giver, not our player;
4. turn advance alone does not clear the last clue;
5. a retouched card keeps accumulated upstream clue knowledge and reports `numPositiveClues >= 2`;
6. the next play or discard clears only the transient last-clue presentation, not the card's semantic clue knowledge;
7. portrait and landscape snapshots pass through production layout math.

## Empty Clues acceptance contract

Zero-touch confirmation follows authoritative table options rather than a UI-only rule:

1. Empty Clues OFF + zero touched cards is not confirmable;
2. Empty Clues OFF + one or more touched cards is confirmable;
3. Empty Clues ON + zero touched cards is confirmable;
4. Empty Clues ON + one or more touched cards is confirmable;
5. the option reaches clue presentation through `GameplayClueChoices.allowEmptyClues` from authoritative metadata;
6. clue preview still uses pinned upstream touch semantics; enabling Empty Clues changes confirmation eligibility, not which cards are considered touched;
7. OFF and ON zero-touch states are both directly inspectable in the developer Gallery using the same canonical stores as `emptyClues.test.ts`.

## Opponent-note acceptance contract

Live note editing follows hand membership, not generic card visibility:

1. own and opponent hand cards are editable live note targets;
2. an accepted note edit updates `clientState.notes` but does not mutate replay actions;
3. turn advance does not invalidate the note or editor target while the card remains in a hand;
4. when the card leaves every live hand, the stored note may remain attached to its card order for knowledge/history purposes, but `noteCard` is cleared and the live editor closes;
5. discard/play/hole visibility does not make a card live-note-editable again;
6. `LobbyRuntime.editNote()` remains the command boundary and rejects cards that are no longer in a live hand.

## Empathy acceptance contract

Empathy is a momentary gesture overlay, never durable gameplay state:

1. holding an opponent card sets only `empathyPlayer` and does not alter authoritative game state;
2. the held hand renders upstream owner-perspective knowledge rather than the opponent's normally open identities;
3. entering or leaving empathy does not change hand/layout geometry;
4. release clears empathy immediately;
5. card selection, clue targeting, note editing, and explicit transient cancellation clear empathy;
6. every authoritative hand sync also clears empathy, even if the same player remains a valid clue target, so an unmounted or moved Pressable cannot leave a sticky hold behind.

## Responsive hand-size acceptance contract

Responsive fixtures must first be semantically possible games:

1. every canonical initial deal length equals the pinned upstream hand-size rule for its metadata;
2. One Extra Card is represented by the authoritative option, never by manually adding a card to an otherwise standard fixture;
3. 3P +1 produces six-card hands and must fit the narrow portrait lane without per-hand horizontal scrolling;
4. 6P +1 produces four-card hands and remains the dense landscape stress case;
5. own-hand cards remain at least as large as opponent cards under the production layout calculation.

## Table-surface acceptance contract

Fireworks and discards are projections of authoritative stacks, not independent UI counters:

1. suit count and suit names come from the pinned upstream variant through selector boundaries;
2. a non-empty firework renders the authoritative top card, while empty stacks retain upstream suit-pip identity;
3. compact fireworks geometry is computed by `getCompactTableFireworksLayout` and all six stacks must fit canonical phone widths;
4. compact discard total equals the authoritative discard-stack length, including cards whose rank identity is hidden or unavailable;
5. known discard ranks remain grouped by suit/rank, while hidden identities are represented explicitly by `unknownCount` rather than silently disappearing;
6. the compact summary and discard viewer therefore share the same authoritative card count even when their presentations differ.

## Reconnect acceptance contract

Reconnect replaces the live room from authoritative bootstrap rather than trying to keep stale client gameplay state alive:

1. a new connection epoch clears the old live room before recovery bootstrap;
2. recovery of the same table receives a new monotonic `gameLoadEpoch`;
3. restored game truth comes from fresh init/history through `GameBootstrapCoordinator`;
4. local note/transient state from the old connection is not silently copied into the restored client state;
5. actions carrying an old connection epoch or old game-load epoch are rejected after restore;
6. current-epoch/current-load mutations remain accepted.

## Rotation and app-state acceptance contract

Viewport/app lifecycle changes may recompute presentation but never mutate authoritative game truth:

1. portrait -> landscape -> portrait uses the production `getGameplayLayout` calculation and the same authoritative game object;
2. returning to the same viewport produces the same layout result deterministically;
3. own-hand cards remain at least as large as opponent cards in both orientations;
4. `GameScreen` clears selected-card arming and transient empathy on orientation change or when the app leaves `active`, while preserving the visible clue target/preview, global empathy, and Note target by card `order`;
5. NoteEditor keeps its open edit transaction and unsaved draft across those lifecycle boundaries; DiscardViewer closes;
6. durable server-derived knowledge, notes, replay actions, hands, stacks, turn state, and score are not rewritten by the lifecycle reset;
7. no lifecycle rule may introduce per-hand horizontal scrolling.

## Finished and replay acceptance contract

Finished state is entered only after the full authoritative postgame sequence is reconciled:

1. `gameOver` and `playerTimes` remain part of the replay action stream but do not by themselves mark the client finished;
2. game-history metadata and full card identities are accepted before finalization;
3. `finishOngoingGame` flips `finished`, records database/timing metadata, and recalculates the former player state as spectator-visible truth;
4. the finished client starts in shared replay at the authoritative penultimate segment and records leader/follower semantics;
5. previously hidden card identities are available to finished/replay presentation after reconciliation;
6. finished layout remains valid in both portrait and landscape without creating a second game-state implementation;
7. replay hands wrap inside the shared vertical surface and never introduce per-hand horizontal `ScrollView` controls;
8. `finished-shared-replay` exposes that exact reconciled state in the Gallery for physical rendering checks.

## Scenario-gallery runtime safety contract

The developer gallery must never become a second live controller:

1. scenario Redux stores remain isolated from the application singleton store;
2. the production `GameScreen` is still used, so local interaction and rendering paths are representative;
3. while the gallery is mounted, the application runtime command gate suppresses gameplay/postgame UI sends such as play, discard, clue, note mutation, pause, replay navigation, and rematch controls;
4. non-command runtime lifecycle/network behavior continues through the raw runtime;
5. suppression is lease-based and nested/idempotent so React development remount behavior cannot leave the application permanently suppressed or release suppression too early;
6. a source guard compares every `lobbyRuntime.*` call made by `GameScreen` with the command-gate suppression list, so adding a new GameScreen runtime command without isolating it fails CI;
7. the active Settings screen owns the Gallery entry under `__DEV__`; duplicate or unreachable Settings implementations are rejected by the source guard.

These invariants are executable in `gameplayScenarios.test.ts`, `scenarioHandSize.test.ts`, `tableSurface.test.ts`, `discardSummary.test.ts`, `reconnectLifecycle.test.ts`, `rotationLifecycle.test.ts`, `finishedReplayLifecycle.test.ts`, `finishedReplayGallery.test.ts`, `emptyClues.test.ts`, `gameplayInteraction.test.ts`, `liveNoteOrders.test.ts`, `runtimeCommandGate.test.ts`, `scenarioRuntimeIsolation.test.ts`, `replayHandPolicy.test.ts`, and `settingsScenarioEntry.test.ts`; prose here documents why the snapshots exist.

## Expansion order

The deterministic gameplay lifecycle matrix is broad enough that the remaining release-confidence step is physical Android smoke. Most rendering checks can now be reached directly from Settings -> Developer -> Gameplay scenarios: clue preview/marker persistence, notes, empathy, extra-card density, six-suit table surface, discard viewer, Empty Clues OFF/ON, and finished/shared replay. Rotation/background lifecycle and reconnect still need real platform/session behavior rather than a fake gallery transport.

For each future scenario, prefer executable assertions over prose whenever the invariant can be expressed deterministically.
