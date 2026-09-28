# Mobile design baseline

Date: 2026-09-28

Status: research baseline only. No runtime behavior is changed by this document.

This snapshot is intended to make the post-beta.3 Mobile App Design pass start from the actual current
product instead of redesigning from memory. It records current navigation ownership, major surfaces,
and decisions that should be made together.

## Current shell / navigation

Authenticated non-game navigation is currently local state in `App.tsx`:

- Lobby is the default/root local screen.
- History, People, and Settings are sibling local screens that return to Lobby.
- Lobby exposes People, Game history, and Open game link as hero actions.
- Settings also has a persistent app-header entry outside the live-game shell.
- Pregame and live game are authoritative room states, not ordinary local screens.
- Entering any room forces the local screen back to Lobby so room state owns the surface.
- Android Back is policy-driven: close live sheets first, then return local screens to Lobby, leave
  Pregame where appropriate, or unattend a live game where appropriate.

This means the current app does not yet have a persistent top-level navigation model. Navigation is a
mix of local-screen state, authoritative room routing, and modal live-game sheets.

## Current live-game shell

For an ordinary 2–6 player live room, `GameScreen` selects the C17 workspace regardless of
orientation, finished/replay state, or shared-replay state. `LegacyGameScreen` remains a fallback
renderer outside that eligibility and is still referenced by tests/scenario coverage.

The live shell is owned by `App.tsx`:

- top game bar with game identity plus Chat and More;
- Chat opens table chat in a modal sheet;
- More opens secondary controls, players/spectators, perspective selection, pause/termination,
  Lobby, Settings, tags, and replay export where applicable;
- Settings is nested inside the live-game sheet rather than navigating away from the room.

A design pass should preserve the distinction between authoritative game state and shell navigation
even if the visual/navigation structure changes.

## Current major non-game surfaces

### Lobby

Lobby combines table discovery, Create, People, History, and game-link entry. It is therefore both a
home/root surface and a feature launcher.

### Pregame

Pregame is a room-owned surface with player roster/actions, table configuration/status, spectators,
chat-related/player context actions, and start/leave controls. GitHub issue #58 specifically calls
out excessive vertical chrome and asks that shell/Pregame density be redesigned coherently rather
than piecemeal.

### History / Review

History currently contains several modes inside one screen:

- My history;
- Friends history;
- Tagged games;
- exact tag search;
- Other Scores for a seed;
- replay-link / JSON import.

The screen already acts as both history browser and review-entry surface.

### People

People is currently an online-user directory. Friends are presentation-prioritized and each eligible
user exposes contextual actions. Private Dialog is embedded in those contextual actions rather than
being a durable messaging destination.

### Settings / account

Settings combines account/security actions, appearance, card presentation, gameplay presentation
settings, and developer-only scenario access.

## Chat / Messaging baseline

There are currently three different concepts that should not be collapsed accidentally:

1. Lobby/table chat: room-oriented live chat with its own unread/read behavior.
2. Contextual private Dialogs: session PM transcript reconstructed from live PM messages seen by this
   client session.
3. Future durable Chats/Messages: not yet designed.

The design pass should decide:

- whether Messages is a top-level destination or belongs under People/Profile;
- conversation-list structure and full conversation screen;
- People/Profile/Game entry points into the same conversation;
- PM unread/read semantics;
- reconnect and app-restart behavior;
- local persistence and logout/shared-device privacy;
- whether a future upstream PM-history read API becomes the durable source.

Upstream already persists PM rows server-side, but the current protocol does not send PM history on
reconnect. A local cache alone would therefore be device-local history, not complete account history.

## Decisions to make as one design system

Do not implement these as isolated UI patches. Resolve them together:

- top-level IA: Lobby/Home, History/Review, People/Profile, Messages/Chats, Settings;
- whether persistent bottom navigation is appropriate and what happens while a game is active;
- active-game affordance from non-game surfaces;
- Android Back semantics under the new shell;
- screen vs sheet vs dialog boundaries;
- compact Pregame structure and issue #58;
- live-game header/HUD ownership of Chat, More, status, and secondary controls;
- History/People/Profile/Messages cohesion;
- Settings/account hierarchy;
- phone portrait, phone landscape, tablet, font scaling, and touch-target behavior;
- Legacy renderer fate after the new shell is proven.

## Constraints to preserve

The design pass must not weaken existing correctness boundaries:

- authoritative room/game routing stays server-driven;
- gameplay commands are never queued/persisted/replayed;
- stable card `order` identity remains the basis for card-bound state;
- replay/rewind/hypothetical must remain isolated from live gameplay sends;
- Android Back must remain deterministic;
- 4–6 player gameplay workspace cannot be made less usable merely to fit navigation chrome;
- accessibility/touch targets remain product requirements.

## Suggested design-pass order

1. Define IA and navigation state model before drawing individual screens.
2. Define active-game behavior and Android Back.
3. Define shell/header/bottom-nav patterns and responsive rules.
4. Redesign Lobby + Pregame together.
5. Redesign live-game shell without rewriting game-state architecture.
6. Unify People/Profile/Messages interaction model.
7. Reframe History as history + review entry.
8. Reorganize Settings/account.
9. Decide whether Legacy remains a supported fallback or becomes removable.
10. Validate the whole system on physical phone portrait/landscape before polishing details.

Issue #4 (rapid replay scrubber jank) remains a performance backlog item and should only be folded into
the design milestone if physical validation shows that the new review UX makes it material.
