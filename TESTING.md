# Hanab Mobile — Testing Guide

This page is for people testing the **Hanab Mobile 1.0.0-beta.4 Android line**.

Beta.4 is the first tester build based on the implemented Mobile App Design v2 shell. Test it like a
normal player. **If an ordinary action or route is hard to discover without instructions, report that
as a UX problem.**

Exact candidate/APK identity and the maintainer release gate live in
`docs/BETA_4_PHYSICAL_SMOKE.md`.

## Before you start

Please note:

- build/commit if it was provided to you;
- phone/tablet model;
- Android version;
- gesture navigation or three-button navigation;
- light or dark theme;
- system font scale if changed from normal.

If you were given an APK directly, install that build. You do not need the source repository.

## What to test

### 1. Browsing and focused rooms

Browse Home, History, People, and More.

Then create or join a Pregame and enter Live play.

Check that:

- focused Pregame/Live does not show the global bottom navigation;
- Browse/Home does not silently leave or unattend the room;
- Return takes you back to the attended room when offered;
- Leave / Unattend / Stop watching are explicit actions;
- Android Back does not accidentally change room attendance.

If it becomes unclear whether you are browsing the app or focused inside a room, report that.

### 2. Normal live play

Play several turns normally.

Try to answer without hunting through menus:

- whose turn is it?
- how many clues, strikes, and cards remain?
- what just happened?
- can you select your own card and understand how to Play or Discard it?
- are Chat and the contextual game/table menu discoverable?

Play/Discard/Clue must remain explicit sends. Accidental or duplicate gameplay commands are
high-priority failures.

### 3. Chat / Conversation / keyboard

Use table Chat and, when convenient, a session Conversation.

Check:

- send/receive works;
- unread behavior is sensible;
- opening/closing Chat or Conversation does not alter attendance;
- with the keyboard open, the first Android Back dismisses the IME rather than leaving the room;
- landscape Chat/menu remains usable.

Session Messages are still session-local rather than durable account-wide history.

### 4. Live rewind and review

Enter Rewind while a game is active.

Try to:

- move backward and forward;
- inspect an older action;
- return to Live;
- let another live action arrive while reviewing if convenient.

While reviewing, Play/Discard/Clue must not accidentally send. Returning to Live must show current
authoritative state.

Also sample a finished Review/shared replay when convenient.

### 5. Hypothetical

From a representative replay/review:

- enter Hypothetical;
- perform one action;
- use Back;
- morph/unmorph a card if convenient;
- exit Hypothetical.

Hypothetical actions must never become live gameplay sends.

### 6. Layout and accessibility

During Pregame, Live, Chat, and Review when possible:

- rotate portrait -> landscape -> back;
- try the other landscape orientation;
- note clipping behind system UI;
- check required controls remain comfortably tappable;
- try enlarged system font if convenient;
- report unreadable cards/text or controls that disappear.

4P/6P and tablet coverage is especially useful because not every tester needs to test the same
density.

### 7. Background / reconnect

During a live game:

- begin an interaction but do not confirm it;
- background and foreground the app;
- allow reconnect/recovery if it occurs.

No old Play/Discard/Clue may fire automatically. Current authoritative state must win after recovery.

### 8. Spectator

If convenient:

- spectate a live game;
- switch perspective;
- return to the normal spectator view;
- Browse and Return;
- explicitly Stop watching.

Participant-only gameplay controls must not become available accidentally, and ordinary Back/Browse
must not silently change attendance.

## Suggested coverage split

You do not need to test everything. Different testers are more useful covering different combinations:

- smaller phone / A55-class phone / tablet;
- 2P / 3P / 4P / 6P;
- portrait / either phone landscape orientation;
- normal / enlarged fonts;
- gesture / three-button navigation;
- player / spectator;
- Rewind / Review / Hypothetical;
- notes / Chat / Conversation;
- rotation / background / reconnect / IME.

## How to report a problem

A useful report can be very short:

```text
Version/build:
Device + Android version:
Navigation: gesture / three-button
Theme + font scale:

What I wanted to do:
What I did:
What I expected:
What happened instead:

Can reproduce: always / sometimes / once
Screenshot or screen recording: attached if useful
```

For a UX/discoverability problem, also say **the first moment where you became unsure what to do
next**. Describe observed behavior rather than guessing at implementation.

## High-priority failures

Call these out explicitly:

- accidental or duplicate Play/Discard/Clue send;
- history/rewind/hypothetical changes the authoritative live game;
- reconnect/background/rotation causes an old armed action to fire;
- returning to Live shows stale state;
- wrong card identity/old slot in history;
- Browse/Back silently changes attendance;
- required controls hidden behind Android system UI;
- app crash/freeze;
- you cannot tell whether you are browsing, focused in a room, Live, or reviewing history.
