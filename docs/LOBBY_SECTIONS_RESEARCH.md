# Lobby sections and create-table placement research

Date: 2026-09-22

Status: research / implementation contract only. No runtime behavior changes.

## Goal

Restructure the mobile Lobby so the user's active game is immediately recoverable and the remaining table discovery surfaces stay clearly separated:

1. **Your running game** (only when a reattendable own game exists)
2. **Pregame tables**
3. **Create table** (only when starting another table is contextually valid)
4. **Running tables**
5. **Shared replays**

The distributed beta.1 APK remains unchanged while tester feedback is collected.

## Current behavior

`LobbyTable` already contains all fields needed to classify the three table/review types:

- `running`
- `joined`
- `sharedReplay`
- `passwordProtected`
- `numPlayers` / `maxPlayers`
- authoritative table options

No new server field or protocol command is required for sectioning.

The current `LobbyScreen` computes:

- `joinTables` from pregame join/spectate eligibility;
- `reattendTables` from own joined running games;
- `spectateTables` from `isSpectateEligible`.

The important current overlap is that `isSpectateEligible` intentionally returns true for
`table.sharedReplay`. As a result, ordinary running games and shared replays are currently rendered
through the same "Running tables" surface.

The current visual order also puts the Create table panel before the discovery lists, while the
Pregame section appears after Running tables.

## Authoritative classification

Keep transport eligibility helpers authoritative, but introduce explicit presentation grouping rather
than using one eligibility predicate as a section definition.

### Pregame tables

A lobby table belongs in Pregame when:

- it is not running;
- it is not a shared replay;
- it is actionable through the existing pregame join and/or pregame-spectate capability.

In current terms this can continue to derive from:

`isJoinEligible(table) || isPregameSpectateEligible(table)`.

Public and password-protected pregames remain in the same section. The existing Private indicator
and transient join-password input remain valid.

### Your running game

A lobby table belongs in Your running game when:

- it is running;
- it is joined by the authenticated user;
- it is not a shared replay;
- existing table options are supported.

In current terms this is `isReattendEligible(table)`.

Render this as a dedicated top-level section above all other lobby table surfaces. Use
`Return to game` as the primary action. Do not duplicate the same table in Running.

### Running tables

A lobby table belongs in Running when:

- it is running;
- it is **not** a shared replay;
- it is not the user's own reattendable game;
- it is ordinarily spectatable.

In current terms this is `isSpectateEligible(table) && !table.sharedReplay`.

Ordinary running games use `Spectate`.

### Shared replays

A lobby table belongs in Shared replays when:

- `table.running` is true;
- `table.sharedReplay` is true;
- existing option/attendance eligibility allows entering it.

In current terms this is the shared-replay subset of `isSpectateEligible(table)`.

Use review-oriented presentation/action copy such as `Review` or `Open review` rather than making
a shared replay look like an ordinary running game.

## Create table visibility

The mobile flow already has an authoritative signal for the case "I left an active game to look at
the lobby".

The live-game **Lobby** action calls `unattendLiveGame(tableID)`. Once back in Lobby, that game is
represented as a running, joined, non-shared table and therefore satisfies
`isReattendEligible(table)`.

Use that existing authoritative table state instead of inventing a local "came from game" flag.

### Rule

Show the Create table surface only when there is **no** reattendable own running game.

Conceptually:

`showCreateTable = runningTables.every((table) => !isReattendEligible(table))`

or equivalently `reattendTables.length === 0`.

This gives the intended behavior:

- normal lobby with no active game -> Create table is available;
- user leaves an active game to inspect Lobby -> Create table is hidden and Return to game is
  prominent in Running;
- after that game is genuinely no longer reattendable -> Create table can return.

Do not key this decision from `localScreen`, stale welcome hints, or a remembered navigation flag.

## Ordered layout

Phone reading order should be explicit in the component tree:

1. Lobby hero / history entry
2. Your running game, when present
3. Pregame tables
4. Create table, when allowed
5. Running tables
6. Shared replays
7. Lobby chat

On wider layouts, responsive columns may be used, but the visual/reading order must remain obvious
and the Create surface must stay conceptually between Pregame and Running rather than becoming an
unrelated permanent left rail.

If Create table grows because of the planned multi-select bot picker, it can become a collapsible or
modal/sheet entry later; that does not change its placement or visibility rule.

## Visual distinction

The web client already distinguishes lobby row types visually:

- unstarted tables use a warm/yellow treatment;
- running tables use green;
- shared replays use a purple/magenta treatment;
- the user's joined table uses a separate blue treatment;
- password-protected pregames are also visually distinct.

Mobile should preserve the **semantic distinction**, not blindly copy web hex values.

Recommended mobile treatment:

- give Pregame, Running, Shared replay, and "Your game" entries distinct theme-aware accent/border or
  badge treatments;
- always include text labels/status so color is not the only signal;
- preserve light/dark contrast and accessibility;
- keep Private as explicit text/iconography, not color only.

Exact palette values belong to implementation/design-system work.

## Interaction details

### Pregame

- Join stays primary when eligible.
- Spectate pregame remains available where supported.
- Password input stays local/transient to the selected protected table.

### Your running game

- Dedicated top-level section shown only when a reattendable own game exists.
- Action: `Return to game`, primary emphasis.
- Never duplicate this table in Running.

### Running

- Contains only other ordinary running games.
- Action: `Spectate`.

### Shared replays

- Dedicated section.
- Review-oriented action copy.
- Preserve existing shared-replay authoritative entry path; this is presentation grouping only.

### Create table

- Same existing authoritative create flow.
- Planned bot multi-select lives here.
- Entire surface is absent while an own running game is reattendable.

## Suggested presentation helpers

Avoid redefining protocol eligibility. Add small presentation selectors/helpers, for example:

- `getYourRunningLobbyTables(tables)`
- `getPregameLobbyTables(tables)`
- `getRunningLobbyTables(tables)`
- `getSharedReplayLobbyTables(tables)`
- `hasReattendableRunningGame(tables)`

These can compose the existing runtime eligibility functions.

The section outputs should be mutually exclusive. The user's reattendable game belongs only in
Your running game; it must not also appear in Running.

## Characterization / acceptance tests

Before or with implementation, cover:

1. ordinary unstarted table appears only in Pregame;
2. password-protected unstarted table appears only in Pregame;
3. ordinary running unjoined table appears only in Running;
4. shared replay appears only in Shared replays and never Running;
5. own running joined table appears only in Your running game, above the other table sections, with Return to game semantics;
6. own running game makes Create table disappear;
7. no own running game makes Create table appear;
8. a shared replay being joined/spectatable does not hide Create table by itself;
9. unsupported table options remain governed by existing eligibility rather than becoming newly
   actionable through presentation grouping;
10. pending attendance/create operations retain their current command-disable behavior;
11. section distinctions remain understandable without color;
12. light/dark themes preserve contrast.

## Non-goals

This restructure does not:

- change server table lifecycle semantics;
- add a second table while the user already owns/plays an active game;
- change reattend/spectate/join commands;
- persist table passwords;
- change shared-replay protocol;
- implement the planned bot picker itself.
