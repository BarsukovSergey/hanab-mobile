# Beta feedback triage and next tester release

Date: 2026-09-22

Status: maintainer guidance for the active `1.0.0-beta.1` tester window and the next Android tester build.

## Frozen beta.1 reference

The distributed tester APK is the frozen beta.1 binary built from:

- version: `1.0.0-beta.1`;
- commit: `d297ad71153095f18fba3101f760e306ed69e214`;
- Android `versionCode`: `1`;
- artifact name: `Hanab-Mobile-1.0.0-beta.1.apk`.

Documentation-only commits after that point do not redefine what testers are running.

When investigating tester reports, reproduce against that frozen commit before assuming current
`main` reflects the reported behavior.

## Feedback triage

Every incoming tester report should first be classified as one of three things.

### 1. Beta.1 bug

A concrete behavior that is broken relative to the beta.1 product/validation contract.

Examples:

- crash or freeze;
- accidental Play/Discard/Clue send;
- wrong authoritative state or stale state after rewind/reconnect;
- note/card identity migration;
- required 2P/3P controls clipped or unusable;
- lifecycle/reconnect behavior that can trigger stale actions;
- a reproducible protocol/correctness failure.

Process:

1. reproduce on the frozen beta.1 commit when possible;
2. record device/Android/navigation/theme/font context from the tester report;
3. decide whether it is blocking, hotfix-worthy, or can wait for the next broader beta;
4. keep the fix narrowly scoped to the observed defect;
5. do not mix unrelated post-beta feature work into the fix.

If a beta.1 hotfix must be shipped before broader post-beta work is ready, branch the runtime fix from
the frozen beta.1 code line or another explicitly chosen beta-maintenance base, not from a large
unrelated feature branch.

### 2. UX feedback

The app is functionally correct, but a normal player cannot easily discover, understand, or operate
the intended flow.

Examples:

- unclear navigation;
- weak information hierarchy;
- confusing labels;
- excessive taps;
- visually ambiguous state;
- a tester cannot tell Live from Rewind;
- a control exists but is hard to discover.

Process:

1. preserve the tester's observed problem, not their guessed implementation fix;
2. compare it with the current C17 UX contract and existing backlog;
3. promote to a concrete issue only when it is specific enough to implement/verify;
4. otherwise consolidate it in the authoritative post-beta backlog.

Do not automatically hotfix every UX preference during the feedback window.

### 3. Post-beta idea

A requested capability or enhancement that is not required by the beta.1 contract.

Examples include already deferred 4P–6P redesign, lobby restructuring, bot conveniences, richer
social/profile features, advanced replay tools, and optional gesture modes.

Process:

- add or reconcile it with `docs/C17_BACKLOG.md`;
- avoid opening duplicate items for the same product need;
- do not let it silently expand the beta.1 acceptance gate.

## Severity / hotfix guidance

Treat the following as strong hotfix candidates if reproducible in the certified beta.1 scope:

- crash, hard freeze, or startup/login blocker;
- accidental authoritative gameplay action;
- replay/rewind mutating live gameplay;
- stale/wrong authoritative state after reconnect or Return to Live;
- corruption or migration of card-bound notes/actions;
- required controls blocked by system UI on ordinary supported Android layouts;
- inability to complete normal 2P/3P play;
- security/correctness issue that should not remain in tester hands.

Prefer next-beta batching for:

- cosmetic polish;
- small copy changes;
- optional convenience controls;
- known 4P–6P density shortcomings;
- non-severe scrubber jank;
- already deferred parity/features.

This is guidance, not an automatic severity score; use the concrete tester impact and reproducibility.

## Next tester build checklist

Do not prepare the next tester binary until its scope is explicitly chosen from actual feedback plus
deliberately selected post-beta work.

For a planned `1.0.0-beta.2` build:

### Versioning

Update all release-facing version locations together:

- `package.json` version;
- `app.json` Expo version;
- `app.json` Android `versionCode` to a value greater than `1`;
- `.github/workflows/android-beta.yml` artifact name.

The local build script derives the APK filename from `app.json`, but the GitHub Actions artifact
name is currently hard-coded separately. Verify both names show the intended beta version.

Do not bump these fields merely for documentation/research work.

### Candidate commit

Before building:

1. identify one exact candidate commit SHA;
2. ensure all intended runtime changes are merged;
3. ensure unrelated experimental branches are not part of the candidate;
4. run ordinary CI successfully on that exact code line;
5. record which beta.1 tester reports are fixed, intentionally deferred, or not reproduced.

Once selected, treat that SHA as immutable for the produced artifact. If code changes afterward,
choose a new candidate SHA and rebuild.

### Build

Keep the Android beta workflow manual-only.

Local equivalent:

```bash
npm ci
npm run android:beta-apk
```

Expected beta.2 filename after version bump:

```text
dist/Hanab-Mobile-1.0.0-beta.2.apk
```

The GitHub Actions workflow must remain triggered by `workflow_dispatch` unless there is a deliberate
separate decision to spend CI minutes on automatic Android builds.

### Upgrade-over-beta.1 validation

The next tester build must be tested as an **upgrade**, not only as a clean install.

On a physical Android device that already has the distributed beta.1 installed:

1. confirm the installed app is beta.1;
2. install the new APK over it without uninstalling beta.1;
3. confirm Android accepts the upgrade, proving package/signing/versionCode continuity;
4. launch the app without Metro/development tooling;
5. verify the expected authenticated/session behavior;
6. verify no unexpected local app state is corrupted;
7. enter a normal 2P/3P table and complete ordinary actions;
8. exercise Rewind and Return to Live;
9. open a replay/shared review/Hypothetical path relevant to the release scope;
10. background/foreground once and confirm no stale action fires.

Also perform at least one clean install before distribution so upgrade success does not hide a fresh
install/startup problem.

### Regression focus

At minimum, preserve the beta.1 high-priority guarantees:

- explicit two-step Play/Discard safety;
- no stale gameplay send after lifecycle interruption;
- stable card `order` identity for notes/actions;
- server-authoritative replay/live separation;
- no unexpected Legacy fallback on accepted C17 paths;
- usable Android system-inset/keyboard behavior;
- accepted 2P/3P real-card gameplay.

Add focused checks for each runtime area changed since beta.1 rather than rerunning unrelated deferred
acceptance work by default.

### Artifact identity

Before sending the APK to testers, record:

- marketing version;
- Android `versionCode`;
- exact commit SHA;
- APK filename;
- APK byte size;
- SHA-256;
- build source: local or specific manual GitHub Actions run;
- date distributed;
- short release notes / tester-visible changes.

Generate the checksum from the exact APK being distributed, for example:

```bash
sha256sum dist/Hanab-Mobile-1.0.0-beta.2.apk
```

Never replace an already distributed APK while keeping the same recorded version/hash identity.

### Distribution notes

Tell testers:

- whether this build should be installed over beta.1;
- the exact version they should see;
- what changed since beta.1;
- which known limitations still apply;
- what areas deserve focused regression testing;
- that reports should include the build/version when possible.

## Relationship to Play Store work

This checklist is for the current standalone internal APK flow.

AAB packaging, store signing, Play Console policy, and production release versioning remain separate
post-beta work. Do not couple Play Store setup to the next tester APK unless intentionally
reprioritized.
