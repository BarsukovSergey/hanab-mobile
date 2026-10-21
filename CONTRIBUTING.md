# Contributing to Hanab Mobile

Thanks for helping improve Hanab Mobile! Bug reports, real-device feedback, documentation improvements, and focused pull requests are welcome.

## Report a bug or suggest an improvement

Use the [GitHub issue templates](https://github.com/BarsukovSergey/hanab-mobile/issues/new/choose). For Android UI problems, a device model, app version, reproduction steps, and a redacted screenshot are particularly helpful.

**Privacy:** never publish passwords, session cookies, table passwords, private chats, or unsanitized network/log captures.

## Work on the project

Hanab Mobile is an Android-first React Native / Expo / TypeScript project. Start with [README.md](README.md) for installation and build commands and [docs/README.md](docs/README.md) for the current technical and product documentation.

- Use Node.js 24 (the version in `.nvmrc`).
- Run `npm ci` before working.
- Keep PRs small and focused; explain the user-visible change and how it was tested.
- Run `npm run validate` and `git diff --check` for code changes. CI also runs these checks.
- Do not run an APK build for a docs-only PR. Native builds are slow and have a separate release gate.
- Follow relevant `AGENTS.md` files when making changes through a coding agent.

## Gameplay and compatibility constraints

The **hanab.live server is authoritative**. Please don't add client-only rules, automatic retry/replay of Play/Discard/Clue commands, or speculative protocol behavior. Preserve reconnect, replay, and room-attendance safety. For upstream-derived code, respect the [documented pins](docs/UPSTREAM.md) and retained [upstream license](src/game/upstream/LICENSE).

If you're proposing a larger design or architecture change, open an issue first so the work can be scoped without destabilizing a release candidate.
