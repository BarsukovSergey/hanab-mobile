# C17 Validation Plan

Status: **active**  
Date: 2026-09-06

This document tracks what C17 still has to prove on real devices. It does not restate game semantics. The current product contract is `docs/C17_UX_CONTRACT.md`.

## 1. Immediate gate: dense 6P workspace prototype

Before broad C17 implementation, build a production-path prototype using the real gameplay view path, real upstream card faces, deterministic fixture state, and correct Android safe-area handling.

### Required prototype state

- phone portrait;
- measured usable safe window, including a small/typical phone class;
- 6 players;
- worst-case supported hand capacity, including One Extra Card where applicable;
- six-suit-capable table state;
- deterministic relative seating;
- current actor / YOUR TURN treatment;
- score and achievable maximum;
- clue count;
- strikes;
- deck count;
- pace;
- FRE when meaningful;
- stack state;
- compact discard summary;
- last-action anchor;
- all opponent hands / summaries;
- own hand;
- reserved Workbench placeholder;
- no root gameplay scroll;
- no per-hand horizontal scrolling.

### What must be decided

Do not evaluate whether boxes fit. Evaluate whether a serious player can actually read them.

Full Ledger passes for a window/text-scale class only if:

- every relevant hand can be read at normal device distance without squinting;
- rank/suit identity remains quick to scan;
- Black/Rainbow/six-suit identity remains distinguishable in light and dark theme;
- note/knowledge/critical/trash signals remain distinguishable without badge clutter;
- selected-card targets remain safe to tap;
- comparing two visible hands does not require traversal or mental reconstruction;
- a serious player would accept the density for a full game.

If this fails, switch that window/text-scale class to Compact Overview + focused/pinned comparison. Do not shrink below readability just to preserve the Full Ledger label.

## 2. Trash/useless visual validation

First candidate: semi-transparent/subdued card treatment familiar from the web presentation.

Pass if:

- trash is immediately obvious in a hand at table-reading distance;
- rank/suit identity is still clear;
- it does not look like an untappable/disabled card;
- it is not confused with personal KT, critical, selection, or empathy state;
- it works in light/dark themes and for Black/Rainbow.

If it fails, compare a subdued backdrop/pattern or another low-emphasis treatment. The semantic requirement is frozen; the exact visual treatment is not.

## 3. Functional animation validation

C17 uses short, non-blocking informational motion.

Validate:

- play/discard departure/destination emphasis;
- clue-touch emphasis;
- actor transition;
- resource delta pulse;
- last-action transition;
- reduced-motion behavior.

Pass if:

- authoritative state is already correct while animation runs;
- the player can inspect the new state immediately;
- no gameplay action is delayed by animation;
- essential meaning remains when animation is disabled;
- repeated actions do not create a backlog of queued animations.

Target duration for small emphasis is roughly 120-180 ms; treat this as a tuning range, not a sacred release number.

## 4. Core physical-device matrix

At minimum cover:

- Android gesture navigation;
- Android three-button navigation;
- portrait;
- both landscape directions where system-bar/cutout geometry differs;
- light/dark theme;
- normal and enlarged font scale;
- keyboard open/closed;
- keyboard suggestion row;
- 2P/3P normal and six-card extra-hand cases;
- dense 5P;
- dense 6P;
- six-suit state;
- spectator state;
- zero clues;
- clue capacity restriction;
- DDA where authoritative fixture supports it;
- final round/end transition;
- finished/replay/shared replay;
- live in-game history.

## 5. Interaction acceptance

### Direct actions

- tap own card selects by identity;
- Play/Discard are explicit second actions;
- unavailable action explains why;
- double tap cannot send twice;
- rotation/background cannot turn a stale press into a send;
- uncertain transport does not queue/retry the gameplay command.

### Notes

- card tap reads without keyboard;
- edit explicitly opens the IME;
- quick tokens preserve previous active note meaning;
- Save/Done is explicit;
- Android Back hides IME first;
- draft/card identity survives rotation;
- card departure ends edit eligibility;
- draft never migrates to replacement slot/card;
- remote conflict never silently overwrites dirty draft.

### Clues

- palette remains available while comparing candidates;
- three candidate changes need no cancel/restart;
- retarget is one action;
- note/discard/recent inspection preserves the clue plan;
- Empty Clues ON/OFF follows authoritative metadata;
- only explicit Give sends;
- state change disarms stale commit.

### Empathy

- persistent per-hand empathy works without hold;
- global empathy toggle works and is clearly labeled;
- row order/geometry does not change;
- notes remain separate from clue knowledge;
- rotation/background preserves valid perspective;
- one action returns to normal identities.

### Live temporal awareness

- current actor and last action are independently understandable;
- after look-away, the player can identify who acted and what changed;
- duplicate-looking cards can be reconstructed to exact old slot/card identity;
- Recent does not auto-scroll away from an inspected older event.

### A29 live history

- enter from active game;
- select prior turn/action;
- `Reviewing Tn` is clearly distinct from `Live Tm`;
- prior counters/table state are not mixed with live counters;
- no Play/Discard/Clue send route is available while reviewing;
- notes/knowledge/discard can be inspected;
- new-live-action count/urgency is visible without forced exit;
- one Live action returns to current state;
- old action selection is not armed after return;
- authoritative live game is unchanged by inspection.

## 6. Pregame/shell validation

Validate the full route:

`Home/Lobby -> create/inspect -> join/spectate -> options -> start -> live -> result/review -> remake/return`

Required checks:

- pregames, spectatable games, and reviews are meaningfully grouped;
- Create Table creates only on explicit final Create;
- spectators are visible in pregame;
- Join as player / Switch to spectator is explicit when eligible;
- owner/start eligibility is clear;
- no fake Ready protocol;
- Settings opens immediately from the room;
- Lobby navigation is distinct from releasing attendance;
- chat input/Send remains above IME;
- Enter sends once;
- chat draft survives rotation/options inspection;
- minimal People/profile/friends surface uses existing capability only.

### Propose Variant capability gate

Before UI implementation, inspect web/upstream/server transport:

1. Is there a structured proposal operation?
2. What payload and eligibility does it use?
3. How is proposal state represented to other users/owner?
4. What does the owner do to accept/apply it?

Only after this is known should the mobile UX be finalized. Do not silently replace a structured capability with plain chat.

## 7. Replay validation

Run a dedicated review session, separate from live-game acceptance.

Required flow:

- enter from finished game/history/shared review;
- understand actual recorded result/reason;
- select a turn;
- scrub timeline;
- use Previous/Next;
- distinguish Start / Last turn / Final state;
- inspect selected event and Before/After;
- compare two hands;
- inspect empathy/knowledge for selected time;
- inspect saved notes with correct “may include later information” provenance;
- open/close full event search without losing selected time;
- detach/re-follow shared leader where applicable;
- transfer leadership where supported;
- correctly label active Hypothetical mode;
- Quick rematch / Remake where eligibility permits.

## 8. Serious-play release gate

Before C17 is considered complete:

- complete at least one serious 5P session on target phone composition;
- complete at least one serious 6P session;
- include dense notes;
- compare at least three clue candidates in real decisions;
- consult discard during clue planning;
- use empathy during real reasoning;
- exercise live history;
- perform look-away reconstruction probes;
- perform a separate replay analysis session.

Required outcomes:

- no root gameplay scrolling in certified Full Ledger states;
- no per-hand sideways scrollers;
- no accidental gameplay commits;
- no note migration;
- no keyboard/system navigation overlap with required controls;
- no lost reasoning draft across documented lifecycle changes;
- no need to repeatedly reopen information only because the UI removed the context;
- the experienced player would willingly play a full serious game using the final composition.

Astra's >=90% correct actor/action/original-slot/key-delta within five seconds can be used as a diagnostic look-away target. Small samples are not statistical proof; investigate every wrong slot/target answer.

## 9. Validation log

Record physical results here as C17 progresses.

| Date | Build/commit | Device / safe window | Scenario | Result | Notes / decision |
|---|---|---|---|---|---|
| — | — | — | Dense 6P Full Ledger prototype | PENDING | First gate before broad C17 implementation. |
| — | — | — | Trash visual candidate | PENDING | Start with semi-transparent/subdued treatment. |
| — | — | — | Functional action animations | PENDING | Verify no blocking/backlog. |
| — | — | — | Serious 5P session | PENDING | Release gate. |
| — | — | — | Serious 6P session | PENDING | Release gate. |
| — | — | — | Replay analysis session | PENDING | Separate release gate. |
