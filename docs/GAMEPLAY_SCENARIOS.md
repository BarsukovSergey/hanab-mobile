# Gameplay scenario harness

The scenario harness exists to make gameplay work scenario-driven instead of discovering requirements one bug at a time on a live table.

## Rules

- A scenario must bootstrap through the same `GameBootstrapCoordinator` and pinned upstream reducers as production. Do not hand-write a parallel `GameState` engine for fixtures.
- The developer gallery renders the production `GameScreen` against an isolated scenario Redux store.
- Scenario stores never replace the application singleton store and do not simulate authoritative network sends. The harness is for deterministic rendering, local interaction states, authoritative snapshots built from server-shaped history, and accepted non-replay actions such as notes.
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

Opponent-note acceptance family:

- `note-edit-source`: an opponent hand card is a valid live note target.
- `note-saved`: the accepted edit updates local note state without entering replay history.
- `note-survives-turn`: the note survives an authoritative turn advance while the card remains in hand.
- `note-card-left-hand`: the noted card is discarded and replaced; stored note knowledge may remain by card order, but the live editor must stop targeting the card immediately.

Table-surface acceptance family:

- `rainbow-table-surface`: `Rainbow (6 Suits)` on a narrow portrait target with an authoritative Rainbow 1 in the sixth firework stack and Red 1 in the discard stack.

Empathy reuses authoritative clue snapshots rather than duplicating the deal. `clue-committed` gives a deterministic opponent card whose open identity differs from the owner-perspective knowledge shown during empathy.

## Clue-flow acceptance contract

The clue family intentionally separates transient interaction from authoritative lifecycle:

1. target + clue choice can be previewed locally from authoritative card identities;
2. committed clue truth comes only from authoritative history;
3. the committed marker is derived from the actual clue giver, not our player;
4. turn advance alone does not clear the last clue;
5. a retouched card keeps accumulated upstream clue knowledge and reports `numPositiveClues >= 2`;
6. the next play or discard clears only the transient last-clue presentation, not the card's semantic clue knowledge;
7. portrait and landscape snapshots pass through production layout math.

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

These invariants are executable in `gameplayScenarios.test.ts`, `scenarioHandSize.test.ts`, `tableSurface.test.ts`, `discardSummary.test.ts`, `gameplayInteraction.test.ts`, and `liveNoteOrders.test.ts`; prose here documents why the snapshots exist.

## Expansion order

Add scenarios when they close a real gameplay risk, not just to increase fixture count. High-value next cases are reconnect/restored state, rotation lifecycle, and finished/replay states.

For each scenario, prefer executable assertions over prose whenever the invariant can be expressed deterministically.
