# Hanab Mobile — Testing Guide

This page is for people testing the **Hanab Mobile 1.0.0-beta.2 Android build**.

You do not need to understand the C17 design documents or the implementation. Test it like a normal player. **If you need instructions to discover an ordinary gameplay control, report that as a problem.**

## Before you start

Please note:

- build/commit if it was provided to you;
- phone model;
- Android version;
- gesture navigation or three-button navigation;
- light or dark theme;
- normal or enlarged system font size.

If you were given an APK/build directly, install that build. You do not need the source repository.

## What to test

### 1. Normal live play

Play several turns normally.

Try to answer without hunting through menus:

- Whose turn is it?
- How many clues, strikes and cards remain?
- What just happened?
- Can you select your own card and understand how to Play or Discard it?
- Does anything important move, clip or disappear?

### 2. Last Action and Recent actions

After several actions have happened:

- inspect the most recent action;
- find the recent-action list;
- check whether the entries are understandable and obviously actionable;
- select an older recent action.

Do not look for a specific button name. If the route is not discoverable, report that.

### 3. Live rewind

Enter rewind while the game is still active.

Try to:

- move one action backward;
- move one action forward;
- move quickly across a larger part of the game;
- jump to the beginning/end using the available controls;
- inspect Last Action / Recent while still in rewind;
- return to the current Live game.

At every point, it should be obvious whether you are viewing history or Live.

While in rewind, Play/Discard/Clue must not accidentally send a gameplay action.

If another live action arrives while you are rewinding, you should not be kicked out of rewind. The UI should make the new live activity visible and returning to Live should show the current authoritative game.

### 4. Look-away check

Look away from the phone for one action, then look back.

Without asking another player, try to determine:

- who acted;
- what they did;
- which card/slot was involved when relevant;
- important score/clue/strike/deck changes.

If that takes too long or the information is unclear, report it even if you eventually figure it out.

### 5. Layout / device behavior

During normal play and rewind, briefly check:

- rotate the phone and rotate back;
- background the app and return;
- light/dark theme if convenient;
- Android system navigation does not cover required controls;
- no hand requires horizontal scrolling;
- required gameplay controls remain comfortably tappable.

## Beta scope and known limitations

This beta is accepted around **2P/3P** gameplay, replay/review, Hypothetical and spectator flows.

**4P–6P dense gameplay is not certified for this beta.** The current Compact Overview / summary-icon layout is known unfinished work and should not be treated as the intended final experience.

Also known and non-blocking for this beta: rapid replay scrubber movement can still show visible jank. `/copy` is intentionally deferred.

Still report crashes, broken navigation, accidental sends, lost state, clipped UI, unreadable cards, or anything that makes ordinary 2P/3P play confusing.

## How to report a problem

A useful report can be very short:

```text
Build/commit:
Device + Android version:
Navigation: gesture / three-button
Theme + font size:

What I wanted to do:
What I did:
What I expected:
What happened instead:

Can reproduce: always / sometimes / once
Screenshot or screen recording: attached if useful
```

For a UX/discoverability problem, also say **the first moment where you became unsure what to do next**.

Do not write implementation guesses. “I wanted to see the previous action and could not tell where to tap” is more useful than “the history reducer is broken.”

## High-priority failures

Call these out explicitly:

- accidental Play/Discard/Clue send;
- history/rewind changes the authoritative live game;
- returning to Live shows stale state;
- wrong card identity/old slot in history;
- required controls hidden behind Android system UI;
- app crash/freeze;
- reconnect/background causes an old armed action to fire;
- you cannot tell whether you are in Live or rewind.
