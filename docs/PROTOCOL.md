# Hanab.live protocol baseline

This document records the protocol facts currently relied on by Hanab Mobile.

Source baseline:

- `Hanabi-Live/hanabi-live`
- pinned commit: `054e859b97ebacc514ca37470e6bdfae5a93d467`

Do not invent fields or command behavior that is not documented here or re-verified against upstream.

## HTTP authentication

### `POST /login`

The official web client submits form data, not JSON.

Required fields for normal login:

```text
username
password
version
```

Optional upstream field:

```text
newPassword
```

For the private development MVP, `version=bot` is intentionally used because the server explicitly allows bot clients to bypass the normal exact client-version check.

Important semantic rule:

```text
POST /login success
!= authenticated session proven
```

After a successful login POST, verify the session with `/test-cookie`.

### `GET /test-cookie`

Observed semantics used by the official client:

```text
200 → session valid
204 → session missing/expired
anything else → indeterminate, not logout
```

Transport failures (DNS/TLS/timeout/offline) are also indeterminate.

### `GET /logout`

Logout uses a credentialed GET. The server clears the platform-owned session cookie and redirects
to `/`. Mobile stops socket/retry ownership before this request, then calls `/test-cookie`; only a
`204` completes signout and permits the explicit local authenticated-state reset.

## Session cookie

Production session cookie name:

```text
hanabi.sid
```

It is an HttpOnly session cookie. Application code should not extract or expose its value if platform networking can keep it private.

## WebSocket

Production endpoint:

```text
wss://hanab.live/ws
```

A valid realtime connection is proven only after receiving and validating the server `welcome` command.

WebSocket `OPEN` alone is not application readiness.

## Wire framing

Hanab application messages are sent as:

```text
COMMAND JSON
```

Examples:

```text
tableJoin {"tableID":123}
action {"tableID":123,"type":0,"target":17}
```

Parsing rule:

1. find the first ASCII space;
2. bytes before it are the command name;
3. the remainder is parsed as JSON;
4. server messages may also exist without a JSON payload.

Do not use a generic `split(" ")` operation for parsing payloads.

## Initial lobby flow

After authenticated WebSocket connection the client receives lobby/session events including:

```text
welcome
userList
tableList
```

Relevant incremental MVP events include:

```text
user
userLeft
table
tableGone
warning
error
```

Exact payload schemas should be implemented incrementally by milestone.

## Reconnect / resume

`welcome` contains `playingAtTables`.

Official-client behavior uses that information to send:

```text
tableReattend {"tableID":...}
```

For a running game, the server then drives the client back through `tableStart` and the normal authoritative game bootstrap.

Do not retry gameplay actions across reconnect.

## Lobby commands needed later

Known MVP commands:

```text
tableJoin
tableLeave
tableSpectate
tableReattend
```

## Chat

The exact pinned inbound `chat` payload is strict:

```text
msg: string (nonempty; pre-escaped HTML/server markup)
who?: nonempty string
discord: boolean
server: boolean
datetime: nonempty string
room?: nonempty string
recipient?: nonempty string
```

The exact pinned inbound `chatList` payload is strict:

```text
list: chat[]
unread: integer
```

Public mobile chat sends:

```text
chat {"msg":"hello","room":"lobby"}
chat {"msg":"hello","room":"table123"}
```

Lobby room is `lobby`; pregame and live-game room is `table${tableID}`. Mobile trims outgoing
messages and rejects blank or longer-than-300-character input. Chat sends are current-READY,
current-room, one-shot commands and are never queued or replayed across connection epochs.

Inbound `msg` is pre-escaped text with optional trusted server markup. Mobile removes server
markup before decoding HTML entities and renders only React Native text, never HTML or a WebView.

Create/start are deliberately outside the critical path to the first playable proof:

```text
tableCreate
tableStart
```

## Spectate

Ordinary spectating uses:

```json
{
  "tableID": 123,
  "shadowingPlayerIndex": -1
}
```

sent with command:

```text
tableSpectate
```

A running table responds by transitioning the client into game mode via `tableStart`.

At the pinned commit, the exact server payload is:

```json
{
  "tableID": 123,
  "replay": false
}
```

For the ordinary running-table spectate path, `replay` is `false`. The client must use the
matching `tableID`; replay tables are outside C4-A.

## Join / pregame / leave

At the pinned commit, an unprotected pregame join sends:

```text
tableJoin {"tableID":123}
```

A password-protected join adds the password only to that one outbound command:

```text
tableJoin {"tableID":123,"password":"..."}
```

Mobile does not persist the password or put it in application state or diagnostics.

The server appends the player and calls `NotifyPlayerChange()` before it calls
`NotifyTableJoined()`. For the joining session, the normal server order is therefore:

```text
game {"tableID":123,...}
joined {"tableID":123}
```

`game` is the authoritative pregame snapshot. The C4-B subset consumes its `tableID`, table
name, owner, players (`index`, `name`, `you`, `present`), `options.variantName`,
`passwordProtected`, and `maxPlayers`. The client must tolerate either `game` / `joined` arrival
order and must not treat a join request or an unconfirmed `game` as attendance.

Leaving sends:

```text
tableLeave {"tableID":123}
```

The pinned Go server's `TableLeftMessage.TableID` field has no JSON tag, so its exact response
uses an uppercase field name:

```text
left {"TableID":123}
```

Only the matching authoritative `left` ends a pregame room. A same-table non-replay
`tableStart` takes precedence over join, pregame, or leave processing and transitions to the
normal game-bootstrap boundary.

Pregame spectating uses the ordinary `tableSpectate` command. The server responds with the same
authoritative `game` plus `joined` attendance pair as a player join; the `game.players[].you`
values are all false. A pregame spectator leaves with `tableUnattend` and waits for the
authoritative own-user Lobby status before leaving local room state.

## C13 table configuration

Create sends `name`, `options`, optional `password`, and `maxPlayers`. Mobile exposes supported
vendored variants plus `cardCycle`, `emptyClues`, `oneExtraCard`, `oneLessCard`, and
`allOrNothing`. It sends timed, speedrun, deckPlays, and detrimentalCharacters disabled on create.
One Extra Card and One Less Card may not both be enabled.

The pregame owner updates a table with:

```text
tableUpdate {"tableID":123,"name":"Table","options":{...},"maxPlayers":5}
tableSetLeader {"tableID":123,"name":"Alice"}
```

`tableUpdate` starts from the complete authoritative pregame options object and changes only the
mobile-exposed values, preserving options mobile does not expose. Mobile waits for a matching
authoritative `game` snapshot for update and leader-transfer truth.

The existing shared-replay restart command supports both transitions:

```text
tableRestart {"tableID":123,"hidePregame":true}  # Quick Rematch
tableRestart {"tableID":123,"hidePregame":false} # restart to pregame
```

Both reuse the C12 boot/new-table transition and wait for authoritative new-table events.

## Game bootstrap

Authoritative bootstrap sequence:

```text
server → tableStart
client → getGameInfo1 {tableID}
server → init {...}
client → getGameInfo2 {tableID}
server → gameActionList {tableID, list:[...]}
client → loaded {tableID}
server → gameAction {...}
server → gameAction {...}
...
```

`tableStart` is a transition signal; it is not the full game state.

`init` contains game metadata such as table/player identity, role, options, seed, and related settings.

At pinned commit `054e859b97ebacc514ca37470e6bdfae5a93d467`, `getGameInfo1` and
`getGameInfo2` both consume exactly `{ "tableID": number }`. The `init` payload is emitted by
`server/src/command_get_game_info_1.go` with these fields:

```text
tableID, playerNames, ourPlayerIndex, spectating, shadowing, replay,
databaseID, hasCustomSeed, seed, datetimeStarted, datetimeFinished, options,
characterAssignments, characterMetadata, sharedReplay, sharedReplayLeader,
sharedReplaySegment, sharedReplayEffMod, paused, pausePlayerIndex, pauseQueued
```

The embedded server `options` object includes `variantID` in addition to the pinned game package's
`Options` fields. Game metadata is constructed with the pinned client algorithm: normalize `-1`
character assignments to `null`, fill empty assignments with one `null` per player, resolve the
pinned variant, then derive end-game length, cards per hand, minimum efficiency, and hard-variant
status before creating the initial game state.

`gameActionList` is the authoritative historical action stream used to reconstruct current state.

The exact pinned response is `{ "tableID": number, "list": action[] }`. The Go action stream can
contain `cardIdentity`, `clue`, `discard`, `draw`, `gameOver`, `play`, `playerTimes`, `strike`,
`status`, and `turn` records. Pinned Go `clue` records include the legacy `turn` field and do not
include the game package's optional-at-runtime `ignoreNegative` property; the official client
therefore applies normal negative clues. `status` records are retained in authoritative history
and are intentional no-ops in the pinned game reducer.

`gameAction` represents subsequent live changes.

At the pinned commit, `getGameInfo2` does **not** mark a player present. It emits the authoritative
`gameActionList` and related game data. The official client sends `loaded {tableID}` only after the
history dispatch has initialized its visible game state. The Go `commandLoaded` handler then sets
`t.Players[playerIndex].Present = true` and notifies connection state. Game start initially sets all
players absent, and `Table.NotifyGameAction()` sends incremental actions only to players whose
`Present` flag is true; active spectators receive them through a separate path without that flag.
Accordingly, a player bootstrap must successfully reduce history and send `loaded` before mobile
exposes LIVE player state. Spectator bootstrap does not need this player-presence handshake.

The pinned official client ignores every game command other than `init` and `gameActionList` while
its game UI is loading. The server builds and emits `gameActionList` while holding the table lock;
incremental `gameAction` notification is a separate path. C5 follows the pinned loading behavior:
premature incremental actions are discarded and never buffered, merged, deduplicated, retried, or
replayed. Only successful full reduction of `gameActionList` can make bootstrap live. Each loading
phase has a bounded watchdog; expiry fails only that current load and sends no retry command.

## Hidden information

The server scrubs hidden card identity information for the receiving player when producing game history/live actions.

The mobile client must still treat server state as authoritative and must not invent or derive secret identities outside the provided game-core semantics.

## Finished game lifecycle

At the pinned commit, the server finishes an ongoing game in this order:

```text
gameHistory [{...}]
cardIdentities {tableID, cardIdentities:[{suitIndex,rank}]}
finishOngoingGame {tableID,databaseID,sharedReplayLeader}
```

`gameHistory` is a bare array of the pinned Go `GameHistory` records, not an object containing a
list. Its `datetimeStarted` and `datetimeFinished` values are JSON strings. They remain strings in
application state; they are never decoded into `Date` objects.

`cardIdentities` supplies the authoritative identity at each card-order index. The official client
uses it to fill scrubbed `draw`, `play`, and `discard` actions, then reconstructs the game with the
same game reducer using spectator/finished semantics.

`finishOngoingGame` records the database ID and shared replay leader. C12-A consumes the result
metadata only; shared replay synchronization and controls remain outside this slice.

## Player actions

Gameplay client command:

```text
action
```

Known action type values:

```text
0 = Play
1 = Discard
2 = Color Clue
3 = Rank Clue
```

Play example:

```json
{
  "tableID": 123,
  "type": 0,
  "target": 17
}
```

Discard example:

```json
{
  "tableID": 123,
  "type": 1,
  "target": 17
}
```

For play/discard, `target` is card order, not a transient UI-array index.

Color clue example:

```json
{
  "tableID": 123,
  "type": 2,
  "target": 1,
  "value": 0
}
```

Rank clue example:

```json
{
  "tableID": 123,
  "type": 3,
  "target": 1,
  "value": 3
}
```

Gameplay mutations are never optimistic:

```text
UI action
→ send once
→ wait
→ authoritative server gameAction
→ reducer/core update
```

## Production safety

Do not run fuzzing, stress tests, reconnection storms, or automated load tests against production hanab.live.

Reconnect must eventually use bounded exponential backoff with jitter, but C1 is an observation/proof spike and must not grow into a production reconnect subsystem.

## Schema policy

Two categories are planned:

### Permissive application events

For lobby/session payloads, validate every field mobile logic relies on while allowing unknown additive server fields where safe.

### Engine-bound events

For `init`, `gameActionList`, and `gameAction`, validation must cover the complete contract consumed by the game-core adapter, not merely fields directly rendered by mobile UI.
