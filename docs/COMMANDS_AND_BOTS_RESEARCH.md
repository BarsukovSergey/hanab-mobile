# Native command controls and bot invite research

Date: 2026-09-22

Status: research only. This document does not change runtime behavior or the distributed beta.1 APK.

## Scope

This note answers two post-beta backlog questions:

1. which hanab.live chat/slash-command capabilities are good candidates for first-class mobile UI;
2. how a simple `Add bot` flow can reuse existing authoritative PM/table behavior without inventing a bot protocol.

Upstream command behavior was checked against `Hanabi-Live/hanabi-live` at
`c1d970bd610395087958fe7d1bb96f52244f7b04`. Bot join behavior was checked against the current
`will-hanabi-bot/scala-bot` implementation at
`86cb2507c400dfefe172ae7f8bef79b9eec97679`, plus the official
`Hanabi-Live/hanabi-live-bot` reference implementation at
`e8e8f36d4fb63cc7d5fa931212d25708fad5638e` where useful.

Important distinction: the maintained scala-bot accepts `/join <password>`, while the official
reference bot only documents/implements the open-table `/join` path and sends `tableJoin` without
a password. "Bot" therefore does not imply one universal invitation capability set.

## Current mobile command boundary

`src/runtime/ChatRuntime.ts` already implements the upstream client-side command family for:

- PM/reply;
- friend/unfriend/friends;
- link/unlink/linked;
- set leader;
- set variant;
- shared-replay turn suggestion;
- tag/tag delete/tag search/delete-all;
- terminate/vote;
- player info;
- client version.

The main upstream client-side omission is `/copy`, which is already separately backlogged because
the web client creates replay JSON locally and copies a shareable representation.

Unknown slash commands are intentionally sent as ordinary chat text. That means server-side commands
such as `/help`, `/random`, `/replay`, `/findvariant`, `/missing`, `/kick`, auto-start,
and split commands can already work through the authoritative server chat-command path without a
new mobile protocol implementation.

Several command-backed capabilities already have first-class mobile UI and should not be duplicated:

- pregame leader transfer;
- table option/variant edits and proposals;
- Pause/Unpause/queued pause;
- vote-to-terminate / terminate.

## Native UI shortlist

### Strong candidates

These have useful structured context in the mobile UI and should not require the user to remember
command syntax:

- **Add bot** — dedicated pregame flow described below.
- **PM user** — action from a user/player/spectator surface that opens a recipient-bound composer.
- **Player info / profile entry** — use existing player-info capability or a richer profile surface
  when that work is implemented.
- **Friend / unfriend** — contextual user action; the existing command transport already exists.
- **Kick player** — pregame owner action on a player row, backed by the existing server-side
  `/kick [username]` semantics unless/until a typed command is deliberately added.
- **Find needed variant / missing max scores** — pregame convenience actions backed by
  `/findvariant` and `/missing`.
- **Suggest current turn** — shared replay action that sends the currently selected turn rather than
  requiring `/suggest [turn]` text entry.
- **Game/replay tags** — add/list/remove/search tags from history/replay UI; this is already a
  separate backlog item and is distinct from note quick-tags.

### Secondary candidates

Useful, but lower priority or more situational:

- auto-start when the next player joins / at a requested player count;
- timed auto-start (`/startin`);
- split / automatic split for large pregames;
- linked-account management;
- explicit replay-link generation/sharing beyond the dedicated `/copy` work.

### Keep as chat/help commands

These do not justify dedicated gameplay chrome by themselves:

- help/document/community links;
- random number;
- shrug;
- server uptime/time-left;
- novelty commands such as impostor.

They can remain typed commands or later appear in a Help/About surface.

## Add bot: authoritative flow

There is no bot-specific hanab.live API. Bots connect as ordinary users and act through the same
WebSocket/table commands as humans.

The maintained scala-bot flow is:

1. a human at a table sends a PM to the bot with `/join` or `/join <password>`;
2. the bot finds the newest non-shared-replay table containing that sender (or where that sender is
   spectating);
3. for an open table, the bot sends ordinary `tableJoin`;
4. for a password-protected table, the bot requires the password from the PM and passes it to
   ordinary `tableJoin`.

Therefore mobile does **not** need a new bot invitation protocol. The native action can reuse
`chatPM` with the bot username as recipient and the join command as the PM body.

## Bot roster

There is currently no authoritative server endpoint or upstream registry that labels online users
as supported bots.

The public bot implementations deliberately make account usernames configurable. Even bot-name
prefix detection in those projects is configuration-driven and empty by default. Mobile therefore
must not guess that a user is a bot from a prefix or naming convention.

If the product wants a picker, use an explicit maintained registry of verified bot accounts, for
example a small source-controlled data file containing:

- stable bot ID;
- exact hanab.live username;
- display name;
- optional short capability/convention description;
- explicit capabilities such as `passwordJoin`, rather than assuming every bot accepts the same PM
  commands.

The actual production usernames must be verified before entries are added. Online/offline state can
then be derived by matching those exact usernames against the authoritative lobby user list.

## Password handling

Current mobile table state intentionally retains only whether a table is password protected. The
password itself is outbound input and is not stored after create/join.

Do not weaken that boundary just to support bots.

For an open table:

- selecting a bot can immediately send PM body `/join` when that bot's verified registry entry
  declares the ordinary PM-join capability.

For a password-protected table created through mobile, avoid asking for the same password twice.
The create-table flow already owns the password as transient form state, so it can optionally collect
**multiple bot selections** at the same time. The picker should allow selecting as many bots as can
fit in the intended table, not assume a 2-player game. After authoritative table creation/attendance
is confirmed, re-check the actual free player slots and send each still-eligible selected bot that
declares `passwordJoin` a PM with `/join <password>`, then clear the create-form password and bot
selections together. Bots without verified protected-table support should be visibly unavailable for
that protected-table flow rather than receiving a command they do not understand. The password still never needs to enter persistent room/application
state.

For an already-existing password-protected table, or a table the current user joined rather than
created, the Add bot sheet should request the password at invite time. Selecting a bot then sends PM
body `/join <password>`, and that transient password is cleared after the attempt.

This keeps the common create-and-invite path one-pass while preserving the current no-password-
retention boundary.

## Proposed mobile shape

A later implementation can stay small:

1. add a source-controlled `knownBots` registry with only verified exact usernames and verified
   per-bot capabilities such as open-table join and protected-table join;
2. add an optional **multi-select** bot picker to Create table so the creator can choose several bots
   before submitting;
3. cap selection by the intended player capacity (creator + selected bots must fit) and, after
   authoritative create/attendance confirmation, re-check actual free player slots before each
   invite;
4. use the still-transient create-form password to send each still-eligible bot only the join form
   its verified capability set supports; protected tables require `passwordJoin`; then clear that
   form state;
5. also show `Add bot` in pregame when there is room for another player;
6. open the same multi-select bot picker showing known bots and their current online/offline state;
7. disable bots already present at the table and prevent selecting more bots than currently free
   player slots;
8. when inviting from an already-existing protected table, request the password transiently because
   mobile intentionally does not retain it in room state;
9. treat each bot invitation independently: one offline/failing bot must not suppress the remaining
   selected invites, and no local success should be synthesized before authoritative feedback;
10. send the existing authoritative PM through the chat/runtime boundary.

No password persistence, bot-only socket protocol, or special table mutation path is needed.

## Suggested implementation order

For the command-to-UI backlog, the lowest-risk useful sequence is:

1. Add bot with multi-select create/pregame flow;
2. contextual PM + player info + friend/unfriend;
3. pregame kick + findvariant/missing;
4. shared-replay Suggest current turn;
5. tags/history workflow;
6. only then consider auto-start/split/linked-account conveniences.

The slash-command path should remain available as fallback/parity even after a native control exists.
