# Mobile gameplay redesign notes

Status: **HISTORICAL / SUPERSEDED FOR C17 PRESENTATION**

> C17 product/UI authority is now `docs/C17_UX_CONTRACT.md`.  
> Product decisions ratified after the Astra review are recorded in `docs/C17_UX_DECISIONS.md`, and unresolved/on-device gates live in `docs/C17_VALIDATION.md`.  
> This file remains useful historical context, but its presentation and gesture choices are not authoritative where they conflict with the C17 contract. In particular, hold-only empathy, global-empathy deferral, blanket transient reset, and a shared root-scroll fallback are superseded. Frozen server/upstream semantics remain governed by the architecture/upstream docs.

This document records the earlier product and architecture direction for redesigning the live-game UI on phones/tablets. The main goal was to avoid losing important gameplay context behind nested scrolling while keeping hanab.live semantics familiar.

## Core UX goal

A Hanabi player often needs to reason about several hands at once (including layered / multi-player finesse sequences). The phone layout must therefore optimize for **simultaneous board awareness**, not for presenting one large panel at a time.

Primary rule:

> In normal play, all player hands should be visible in one gameplay viewport whenever physically reasonable.

The current desktop-like vertical page with horizontal `ScrollView`s for individual hands is not the target interaction model.

## Stable gameplay viewport

Gameplay geometry should stay stable during common interactions.

- Do not resize/reflow a hand when clue targeting, clue preview, empathy, or card selection changes.
- Do not make empathy zoom a hand and push other hands around.
- Prefer overlays, borders, arrows, content changes, and a stable action area over layout shifts.
- If an interaction needs a larger secondary view (notes, full discard inspection, game log), open it above the game rather than rebuilding the game layout.

## Hand layout

### Our hand

- Our hand is placed **above the other player hands**, matching the familiar hanab.live reading order.
- Our hand is larger than opponent hands because it is the primary Play / Discard / Note interaction surface and its knowledge markings need to remain readable.
- All cards in our hand should fit without a per-hand horizontal scroll in normal supported configurations.

### Opponent hands

- All opponent hands remain visible at the same time when possible.
- Opponent cards are smaller than our cards.
- Outside empathy, opponent cards show their **actual open identities**. They do not show the owner's knowledge pips by default.
- Tapping an opponent card opens that card's note UI.
- Tapping the player name / player row selects that player as the clue target.
- Selecting a clue target should highlight the target without resizing the hand.

### Small-screen fallback

Layout sizing should be computed from viewport dimensions, player count, cards per hand, and orientation rather than from a fixed collection of unrelated magic numbers.

When space is tight:

1. reduce opponent card size and gaps within readable bounds;
2. keep our hand and all opponent hands visible if possible;
3. only as a last resort allow a **single shared vertical scroll for the overall hands area**.

Do not fall back to separate horizontal scrolling for every hand.

Layout calculations should be testable for at least:

- small phone;
- typical phone;
- tablet;
- 2 through 6 players;
- modifiers that change hand size, such as One Extra Card / One Less Card;
- supported variants with unusual suit counts.

## Empathy

Empathy is a missing functional parity item in the current card-presentation work: the mobile selector currently passes `empathy: false` explicitly.

Target mobile interaction:

- Press and hold on an opponent hand/card to enable empathy for that **entire hand**.
- Releasing the press disables empathy.
- Empathy is momentary by default rather than a sticky toggle, so the player cannot accidentally leave it enabled.
- The hand stays in exactly the same geometry while empathy is held.
- The card contents switch from open identities to the owner's knowledge representation (partial/unknown faces and pips) using upstream presentation semantics.
- A small haptic on empathy activation is reasonable if it feels useful on device.

A future global-empathy toggle can be added separately if desired; it is not required for the base gesture.

## Card tap / player tap semantics

Keep interactions deliberately simple:

- tap our card -> select it for Play / Discard / Note;
- long-press our card -> open note editor (existing familiar shortcut can remain);
- tap opponent card -> open/show that card's note;
- tap opponent player name/row -> select clue target;
- hold opponent hand/card -> empathy.

There is no separate persistent "opponent hand focus" state required just to make a hand larger.

## Gameplay actions

Use a stable context/action area rather than moving cards around.

When our card is selected, expose at least:

- Play;
- Discard;
- Note.

`Discard` here means the gameplay action and must remain a direct action. It must not open the discard-pile viewer.

## Clue flow

The current mobile UI sends a clue immediately when a color/rank button is pressed. The redesign should introduce an explicit preview/confirm step.

Target flow:

1. select the recipient by tapping the player row/name;
2. choose a color or rank;
3. enter local clue-preview state without sending anything;
4. visibly mark every card that would be touched;
5. show a clear `Give clue` confirmation action;
6. only confirmation sends the authoritative gameplay command.

Clue preview is transient UI state and must not mutate authoritative game state.

### Last clue indication

After the server-authoritative clue is applied:

- show which clue was given (for example `Alice -> Bob · Red`);
- show arrows/indicators on the cards touched by that clue;
- keep the latest clue indication visible **until the next gameplay action**, rather than using only a short toast timer;
- replay/reconnect rendering should derive this from authoritative action/state history where possible rather than from an ephemeral local `lastClue` variable.

Exact arrow/indicator styling remains a visual-prototype decision, but the information parity with web clue arrows is required.

## Fireworks and discard information

### Fireworks

Fireworks are always visible in the main gameplay viewport.

- Render the actual top card faces using the upstream-generated card assets.
- They may be smaller than hand cards, but should remain real cards rather than text-only `R3 / Y2 / ...` labels.
- For variants with many suits, scale the stack cards to available width rather than introducing another horizontal scroller.

### Discard summary

The discard pile is strategically important and should not disappear behind a generic count-only button.

The main viewport should contain a **compact but informative discard summary**. The exact design is still open; possible prototypes include:

- mini-card groups;
- rank/suit counts such as `R1x2`;
- a compact suit/rank matrix.

The summary must stay small enough not to push hands out of the viewport.

### Full discard viewer

Tapping the discard summary opens a large secondary viewer (for example a high bottom sheet / overlay) containing the full discard pile.

This is for **inspection of cards already discarded**. It is unrelated to the `Discard selected` gameplay action.

Possible future enhancement (not required for the first redesign): filter/group discarded identities by current relevance, for example cards that may still matter for maximum score versus identities already safely covered by completed stacks. If added, use upstream/game-core semantics rather than a UI-only approximation.

## Notes UX

Bring the mobile note editor closer to useful web behavior.

Required behavior:

- tap opponent card -> open that card's note;
- our card can expose Note from the action area and retain long-press as a shortcut;
- pressing Enter submits/saves the note immediately;
- when editing a non-empty note, append ` | ` for the new segment as web does;
- trim a trailing separator on submit;
- keep an explicit Save control for touch users if useful.

Do **not** add an invented live semantic preview while typing; web does not require that behavior.

### Future quick note actions

Inside the note editor, consider quick buttons that append common upstream-recognized note tokens rather than inventing mobile-only semantics. Candidate groups include:

- Finesse (`f` and related aliases as appropriate);
- Chop Move (`cm`);
- Permission to Discard (`ptd` / related aliases);
- Known Trash;
- `?` / `!`;
- Needs Fix;
- Clued / Unclued.

The parser/reducer remains the source of truth for what those tokens mean.

## Transient UI state

Avoid continuing to grow a set of unrelated booleans such as `selectedCard`, `selectedTarget`, `noteEditorOpen`, clue preview fields, and empathy flags without an explicit interaction model.

Use a reducer / discriminated interaction state (no new state-machine dependency is required), conceptually covering modes such as:

- idle;
- our card selected;
- clue target selected;
- clue preview;
- empathy held;
- note editor open.

The exact shape can allow orthogonal state where necessary, but impossible combinations should be prevented deliberately.

Authoritative game state and transient UI state must remain separate:

- server/reducer state decides what actually happened;
- transient state decides what the user is previewing/selecting locally.

## Card rendering / performance boundary

The visual card face is comparatively heavy and currently uses SVG XML rendering. Treat the face as an isolated, memoizable rendering primitive.

Target separation:

```text
Card
|- memoized CardFace (variant + suit + rank)
`- lightweight overlays
   |- selection
   |- clue / semantic border
   |- note indicator
   |- clue arrows
   `- empathy knowledge overlay
```

Changing app theme, selecting another player, or opening a secondary panel should not require reparsing/rebuilding every unchanged SVG card face.

Investigate:

- memoizing card-face components;
- caching parsed SVG/AST representations where supported;
- keeping theme-dependent styling outside the heavy face.

This should also be considered when investigating the existing multi-second theme-switch delay and previously observed heavy finished/replay transitions. The exact performance root cause still needs measurement; do not treat this note as proof that SVG parsing is the only cause.

## Theme and app shell

The current header is overcrowded on narrow phones. Theme controls should move out of the game/header row into a real Settings surface.

Settings direction:

- move System / Light / Dark choice into Settings;
- persist theme preference across launches;
- keep the game header compact and stable;
- fix shared responsive text/pill behavior rather than patching individual overflows with arbitrary margins.

A theme switch should still feel effectively immediate even after the control moves to Settings; a multi-second delay is considered a performance bug, not acceptable expected behavior.

## Secondary surfaces

The main gameplay viewport should contain first-order game information. Secondary inspection tools should not become permanent giant panels in the scroll path.

Good candidates for overlays/sheets or dedicated secondary surfaces:

- note editor;
- full discard inspection;
- full game action log;
- settings;
- other non-turn-critical details.

Opening one of these may cover most of the game temporarily; the important requirement is that closing it returns to the same underlying gameplay context without rebuilding a different long page.

The game log means the chronological list of gameplay actions/events (clues, plays, discards, etc.). It is useful for inspection/review but is not first-order information that must occupy the normal phone viewport.

## Orientation and device classes

Support both portrait and landscape rather than hard-coding one orientation.

### Portrait phone

This is the primary first implementation target because multiple hands naturally form horizontal rows stacked vertically.

Likely structure:

```text
HUD
fireworks + compact discard summary
our hand (larger)
opponent hand
opponent hand
...
stable context actions
```

### Landscape phone

Do not simply stretch the portrait stack. Landscape has more width but much less height, so use a composition that spends width intelligently (for example multiple hand regions/columns or a table region beside hand regions).

The interaction/game state must survive rotation; only geometry changes.

### Tablet

Tablet layouts can use substantially more space and may approach web density while preserving the same interaction semantics. Both phone and tablet behavior should be driven by responsive geometry rather than separate game logic.

## Upstream parity rule

Do not duplicate Hanabi semantics in UI code.

Use pinned/vendored upstream game/presentation logic for:

- card identities and partial identities;
- pips/eliminations;
- empathy possibilities;
- clue touch semantics;
- special note meaning;
- semantic borders;
- any future discard-relevance calculation.

Mobile UI should adapt presentation and gestures, not fork the rules.

When behavior depends on upstream details, check the deliberately pinned upstream source documented in `docs/UPSTREAM.md`; do not silently switch assumptions to a newer upstream `main`.

## Known current gaps / issues feeding this redesign

- empathy is currently explicitly disabled in mobile card-presentation calls;
- phone gameplay requires excessive vertical/horizontal scrolling;
- tapping an opponent card currently mostly duplicates player-target selection rather than doing a card-specific useful action;
- clue buttons send immediately, with no preview/confirm step;
- latest clue type/touched-card focus is not clear enough after the action;
- note Enter currently behaves like multiline editing instead of immediate submit;
- note editing lacks web's convenient automatic ` | ` continuation behavior;
- theme switch can take multiple seconds;
- narrow headers/text/status pills can overflow or squeeze the Hanab brand;
- theme switcher still occupies scarce header space instead of Settings;
- card rendering density/geometry needs visual tuning on phone;
- heavy SVG work may be contributing to theme/replay transition latency and should be isolated/measured.

## Decisions to validate on the first visual prototype

These should be decided on-device rather than over-specified before seeing the layout:

1. exact card sizes/gaps for our hand versus opponent hands;
2. exact clue-arrow / clue-preview visual treatment;
3. exact compact discard-summary representation;
4. exact portrait and landscape compositions at representative device sizes;
5. whether compact empathy is readable without any additional non-layout-shifting magnification overlay.

These are visual tuning questions, not reasons to return to the current nested-scroll architecture.
