# C10 Results — Standalone Lobby + Create/Start

Status: **GO**

## Implementation

- Replaced the proof-console lobby with a standalone session, login, lobby, pregame, loading, and game flow.
- Added typed `tableCreate` support for the four basic variants and fixed v1 options.
- Create waits for matching authoritative `game` and `joined` events in either order before entering pregame.
- Added owner-only `tableStart` with the current authoritative player names.
- Create and Start intents are one-shot, are cleared on warning/error or connection replacement, and are never replayed across connection epochs.
- Successful Start reuses the existing authoritative game bootstrap and gameplay path unchanged.

## Physical Android proof

**PASS**

The physical proof established:

- the app opened directly into the lobby with a valid saved session;
- mobile created a 2-player Rainbow (6 Suits) table;
- the browser saw the correct table and variant and joined it;
- mobile pregame updated authoritatively to 2/2 players and enabled Start;
- Start from mobile launched the same game on both clients;
- a mobile gameplay action synchronized to the browser.

## Conclusion

C10 is **GO**.

## Next milestone

C11 — chat, polish, and Android build cleanup.
