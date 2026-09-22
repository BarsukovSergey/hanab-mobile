# Lobby sections and create-table placement research

Date: 2026-09-22

Status: research / implementation contract only. No runtime behavior changes.

## Goal

Restructure the mobile Lobby so table discovery has four clear ordered surfaces:

1. **Pregame tables**
2. **Create table** (only when starting another table is contextually valid)
3. **Running tables**
4. **Shared replays**

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

### Running tables

A lobby table belongs in Running when:

- it is running;
- it is **not** a shared replay;
- and it is either the user's own reattendable game or an ordinarily spectatable running table.

In current terms:

- own game: `isReattendEligible(table)`;
- other game: `isSpectateEligible(table) && !table.sharedReplay`.

The user's own running game should be the first entry in this section and use `Return to game`.
Other running games use `Spectate`.

Do not keep a separate "Your running game" section; it is still a running table and can be
distinguished inside the Running section.

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
2. Pregame tables
3. Create table, when allowed
4. Running tables
5. Shared replays
6. Lobby chat

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

### Running

- Own joined running game: `Return to game`, primary emphasis, "Your game" indicator.
- Other running games: `Spectate`.
- Do not duplicate the own game in another section.

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

- `getPregameLobbyTables(tables)`
- `getRunningLobbyTables(tables)`
- `getSharedReplayLobbyTables(tables)`
- `hasReattendableRunningGame(tables)`

These can compose the existing runtime eligibility functions.

The three section outputs should be mutually exclusive.

For Running, sort the reattendable own game first, then keep a deterministic order for the rest
(existing table order or table ID is sufficient).

## Characterization / acceptance tests

Before or with implementation, cover:

1. ordinary unstarted table appears only in Pregame;
2. password-protected unstarted table appears only in Pregame;
3. ordinary running unjoined table appears only in Running;
4. shared replay appears only in Shared replays and never Running;
5. own running joined table appears only in Running, first, with Return to game semantics;
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
