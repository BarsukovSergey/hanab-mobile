# Gameplay scenario harness

The scenario harness exists to make gameplay work scenario-driven instead of discovering requirements one bug at a time on a live table.

## Rules

- A scenario must bootstrap through the same `GameBootstrapCoordinator` and pinned upstream reducers as production. Do not hand-write a parallel `GameState` engine for fixtures.
- The developer gallery renders the production `GameScreen` against an isolated scenario Redux store.
- Scenario stores never replace the application singleton store and do not simulate authoritative network sends. The first harness is for deterministic rendering and local interaction states.
- Canonical viewport dimensions belong to the scenario registry and are exercised through the same pure `getGameplayLayout` calculation as production. The gallery itself renders on the current device viewport.
- A gameplay feature is not considered closed merely because one happy-path component test passes. Its scenario should capture the important authoritative state, transient interaction state, responsive geometry, and lifecycle expectations.

## Initial canonical scenarios

- `three-player-base`: ordinary three-player portrait turn.
- `clue-preview-source`: deterministic deal with a known one-card color clue target; in the gallery, tap Bob then the red clue to inspect the production preview flow.
- `six-player-landscape`: dense six-player landscape target with four-card hands.

## Expansion order

Add scenarios when they close a real gameplay risk, not just to increase fixture count. High-value next cases are committed clue persistence, empathy hold/release, opponent notes, extra-card hands, many-suit fireworks, discard viewer, reconnect/restored state, rotation lifecycle, and finished/replay states.

For each scenario, prefer executable assertions over prose whenever the invariant can be expressed deterministically.
