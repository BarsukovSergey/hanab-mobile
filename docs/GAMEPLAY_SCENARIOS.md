# Gameplay scenario harness

The scenario harness exists to make gameplay work scenario-driven instead of discovering requirements one bug at a time on a live table.

## Rules

- A scenario must bootstrap through the same `GameBootstrapCoordinator` and pinned upstream reducers as production. Do not hand-write a parallel `GameState` engine for fixtures.
- The developer gallery renders the production `GameScreen` against an isolated scenario Redux store.
- Scenario stores never replace the application singleton store and do not simulate authoritative network sends. The harness is for deterministic rendering, local interaction states, and authoritative snapshots built from server-shaped history.
- Canonical viewport dimensions belong to the scenario registry and are exercised through the same pure `getGameplayLayout` calculation as production. The gallery itself renders on the current device viewport.
- A gameplay feature is not considered closed merely because one happy-path component test passes. Its scenario should capture the important authoritative state, transient interaction state, responsive geometry, and lifecycle expectations.

## Canonical scenarios

Base and responsive coverage:

- `three-player-base`: ordinary three-player portrait turn.
- `six-player-landscape`: dense six-player landscape target with four-card hands.

Clue-flow acceptance family:

- `clue-preview-source`: deterministic one-card red clue target for the production local preview flow.
- `clue-committed`: authoritative clue has landed and the server has advanced the turn; the last-clue marker and upstream orange positive-clue border must still be visible.
- `clue-retouched-quacker`: the same card is positively clued again by Cathy with Quacker assigned; the marker must use the actual giver semantics (`Quack`) and render as a retouch.
- `clue-cleanup-after-discard`: the next authoritative discard clears the last-clue marker while the card's accumulated upstream clue knowledge and orange semantic border remain.

## Clue-flow acceptance contract

The clue family intentionally separates transient interaction from authoritative lifecycle:

1. target + clue choice can be previewed locally from authoritative card identities;
2. committed clue truth comes only from authoritative history;
3. the committed marker is derived from the actual clue giver, not our player;
4. turn advance alone does not clear the last clue;
5. a retouched card keeps accumulated upstream clue knowledge and reports `numPositiveClues >= 2`;
6. the next play or discard clears only the transient last-clue presentation, not the card's semantic clue knowledge;
7. portrait and landscape snapshots pass through production layout math.

These invariants are executable in `gameplayScenarios.test.ts`; prose here documents why the snapshots exist.

## Expansion order

Add scenarios when they close a real gameplay risk, not just to increase fixture count. High-value next cases are empathy hold/release, opponent notes, extra-card hands, many-suit fireworks, discard viewer, reconnect/restored state, rotation lifecycle, and finished/replay states.

For each scenario, prefer executable assertions over prose whenever the invariant can be expressed deterministically.
