# Card presentation parity

This document records the card-presentation semantics that Hanab Mobile intentionally follows from hanab.live. It exists so future UI refactors do not accidentally replace upstream behavior with simpler-looking local rules.

## Upstream source

The presentation selectors are adapted from:

- Repository: `Hanabi-Live/hanabi-live`
- Commit: `7a9c601b66f5966f7e33564855e25f82e68a94ed`
- Commit message: `refactor: extract card presentation selectors (#3115)`
- Source: `packages/client/src/game/ui/cardPresentation.ts`

Mobile copy:

- `src/game/client/cardPresentation.ts`

The mobile file is intended to keep the upstream selector behavior while rewriting imports to use the vendored game core.

This presentation source is deliberately newer than the baseline game/protocol/render pin documented in `docs/UPSTREAM.md`. See that file for why the repository currently tracks these as scoped pins instead of pretending the entire vendored upstream closure moved to the presentation commit.

## Identity shown on a card

`getCardIdentityToShow` is the source of truth for whether a card face shows a suit, a rank, both, or neither.

### Normal (non-empathy) presentation

- Prefer a real/known card suit or rank when one is available.
- A note may determine a suit when all surviving note possibilities share the same suit.
- A note may determine a rank when all surviving note possibilities share the same rank.
- Note possibilities are intersected with `possibleCardsFromClues`.
- If that intersection is empty, fall back to the clue-derived possibilities rather than treating the card as having no possibilities.
- Partial identities are valid: known suit + unknown rank, unknown suit + known rank, fully known, or fully unknown.
- For an ongoing stack-base card, a rank inferred from a note can take precedence over the real rank; this preserves upstream morphing behavior for relevant variants.

Do not collapse these states into a binary "known / unknown" mobile representation.

### Empathy presentation

Empathy answers a different question: **how does this card appear from the owner's knowledge perspective?**

When empathy is enabled:

- ignore normal note-derived display identity;
- show the suit only when the card state says the suit is determined;
- show the rank only when the card state says the rank is determined;
- use empathy-specific possibility state for pips;
- preserve upstream morph fallback semantics where applicable.

Normal opponent hands are still open real cards. Empathy is the temporary alternate presentation; it is not the normal opponent-hand mode.

## Clue state: positive versus merely applied

Do not use `hasClueApplied` as the definition of a visually clued card.

In the vendored upstream rules:

```ts
isCardClued(cardState) === cardState.numPositiveClues > 0
```

A clue action applies both positive and negative information:

- touched cards increment `numPositiveClues` and set `hasClueApplied`;
- untouched cards can still receive negative clue information and set `hasClueApplied`, without incrementing `numPositiveClues`.

Therefore a card may have:

```text
hasClueApplied = true
numPositiveClues = 0
```

and **must not** receive the normal clue border just because negative information was applied.

This distinction caused a real mobile regression before the upstream selector was adopted; preserve the regression test.

## Border semantics

`getCardBorderPresentation` owns semantic border precedence.

A played or discarded card cannot show any hand border.

For a card still in a hand, precedence is:

1. clue;
2. finesse;
3. discard permission;
4. chop moved.

Mobile currently maps those semantic states to:

| Semantic border | Mobile color |
| --- | --- |
| clue | `orange` |
| finesse | `aqua` |
| discard permission | `#812020` |
| chop moved | `#fffce6` |

Do not compute these independently in `GameCard` or other UI components; consume the presentation/view-model result.

### Note overrides

- `note.unclued` suppresses the clue border.
- `note.clued` can force the clue border even when normal positive-clue state would not.
- If both convention-note flags are present, the precedence above still applies.

### Finished games

When `finished` is true:

- finesse border is hidden;
- discard-permission border is hidden;
- chop-moved border is hidden;
- clue border is not suppressed merely because the game ended.

This is intentional upstream behavior.

## Knowledge pips

`getCardPipPresentation` distinguishes three semantic pip states:

- `Hidden`;
- `Eliminated`;
- `Visible`.

For normal presentation:

- start from note possibilities intersected with clue possibilities;
- use `state.possibleCards` to distinguish surviving from eliminated possibilities.

For empathy presentation:

- ignore note narrowing for the clue-visible set and use `state.possibleCardsFromClues`;
- use `state.possibleCardsForEmpathy` to distinguish surviving from eliminated possibilities.

Positive clue emphasis is also semantic data:

- suit pips are marked positive from `positiveColorClues`;
- rank pips are marked positive from `positiveRankClues`.

UI styling may evolve, but it must not throw away the distinction between hidden, eliminated, visible, and positive pips.

## Testing clue application correctly

`cardPossibilitiesReducer` narrows possibilities, but it is not the whole production clue action.

Production `cardsReducer` also updates bookkeeping around a clue:

- positive touched cards increment `numPositiveClues` and set `hasClueApplied`;
- negative cards set `hasClueApplied` without incrementing `numPositiveClues`.

A unit test that calls only `cardPossibilitiesReducer` must mirror this bookkeeping when it intends to model a real clue. Otherwise border tests can accidentally test an impossible/incomplete state.

The existing mobile test helper in `cardKnowledge.test.ts` does this deliberately. Keep that distinction visible if the tests are reorganized.

## Current mobile integration

`src/game/selectors/cardKnowledge.ts` adapts the upstream presentation selectors into mobile-friendly values:

- displayed suit/rank;
- semantic border color;
- positive clue labels/ranks;
- possible suits/ranks;
- suit/rank pips;
- determined flags.

The UI should continue to receive presentation results from this boundary instead of reimplementing clue/note/knowledge rules in components.

## Known parity gap: empathy wiring

At the time this document was written, `getCardKnowledgeViewModel` still passes `empathy: false` to both:

- `getCardIdentityToShow`;
- `getCardPipPresentation`.

That is a known integration gap, not an intentional product rule. The selectors already support empathy; mobile still needs to pass the actual empathy state and expose the interaction described in `docs/MOBILE_GAMEPLAY_REDESIGN.md`.

Do not consider card-presentation parity complete while empathy remains hard-coded off.

## Rules for future changes

When changing card appearance semantics:

1. check the scoped upstream source/pin first;
2. prefer adapting an upstream selector over adding a mobile-only interpretation;
3. add a regression test for any semantic distinction that previously caused a bug;
4. keep actual Hanabi state authoritative and keep purely visual choices in UI code;
5. if a newer upstream commit is required, update `docs/UPSTREAM.md` deliberately rather than silently reading current upstream `main`.
