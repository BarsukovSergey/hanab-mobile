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

## Game bootstrap

Authoritative bootstrap sequence:

```text
server → tableStart
client → getGameInfo1 {tableID}
server → init {...}
client → getGameInfo2 {tableID}
server → gameActionList {tableID, list:[...]}
server → gameAction {...}
server → gameAction {...}
...
```

`tableStart` is a transition signal; it is not the full game state.

`init` contains game metadata such as table/player identity, role, options, seed, and related settings.

`gameActionList` is the authoritative historical action stream used to reconstruct current state.

`gameAction` represents subsequent live changes.

Before implementing this phase, re-verify exact current schemas and determine whether a live `gameAction` observed during bootstrap can overlap with the later `gameActionList`. Do not implement naive history+deferred concatenation until that semantic is proven.

## Hidden information

The server scrubs hidden card identity information for the receiving player when producing game history/live actions.

The mobile client must still treat server state as authoritative and must not invent or derive secret identities outside the provided game-core semantics.

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
