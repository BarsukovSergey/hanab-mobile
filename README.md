<p align="center">
  <img src="assets/icon.png" alt="Hanab Mobile app icon" width="112" />
</p>

<h1 align="center">Hanab Mobile</h1>

<p align="center">
  <strong>Play, spectate, and review Hanabi on Android.</strong><br />
  An unofficial mobile client for <a href="https://hanab.live">hanab.live</a>, built for serious games on a small screen.
</p>

<p align="center">
  <a href="https://github.com/BarsukovSergey/hanab-mobile/releases"><strong>Download for Android</strong></a>
  &nbsp;·&nbsp;
  <a href="TESTING.md">Testing guide</a>
  &nbsp;·&nbsp;
  <a href="https://github.com/BarsukovSergey/hanab-mobile/issues/new/choose">Report a problem</a>
</p>

<p align="center">
  <a href="https://github.com/BarsukovSergey/hanab-mobile/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/BarsukovSergey/hanab-mobile/actions/workflows/ci.yml/badge.svg" /></a>
  <img alt="Android APK" src="https://img.shields.io/badge/Android-APK-3DDC84?logo=android&logoColor=white" />
  <img alt="Prerelease" src="https://img.shields.io/badge/status-prerelease-orange" />
</p>

## Made for playing, not just viewing

- **Live Hanabi:** create or join supported 2–6-player games, with explicit Play, Discard, and Clue controls.
- **Spectating:** watch a live table, switch player perspective, and stay out of the action.
- **Review and analysis:** rewind live turns, inspect finished games, use shared replay, and explore Hypothetical lines.
- **Useful game context:** real card faces, notes, knowledge and clue cues, resources, recent actions, and game history.
- **Community:** table chat, friends and player profiles, and session-based private conversations.
- **Phone-first layouts:** portrait and landscape views, with room-aware browsing and a quick way back to your table.

Some specialized hanab.live variants and features are not supported yet. This is a testing release, so layout and performance feedback is especially welcome.

## Install on Android

1. Open the [GitHub Releases](https://github.com/BarsukovSergey/hanab-mobile/releases) page.
2. Choose the newest **published** testing release and download its `Hanab-Mobile-*.apk` file from **Assets**.
3. Open the APK on your Android device. You may need to allow installs from your browser or file manager.
4. Sign in with your hanab.live account.

**Android only for now.** The app is distributed as a standalone prerelease APK, not through Google Play. You do not need to build the source to try it.

If you run into trouble, the [testing guide](TESTING.md) explains what to report. Please never post passwords, session cookies, private messages, or unredacted logs in a public issue.

## Feedback and contributions

Found a crash, a hard-to-tap control, an incorrect game state, or confusing navigation? [Open an issue](https://github.com/BarsukovSergey/hanab-mobile/issues/new/choose). Include the app version, Android version, device, steps to reproduce, and a screenshot when useful.

Want to contribute code or docs? See [CONTRIBUTING.md](CONTRIBUTING.md). You can also browse the [product roadmap](docs/PRODUCT_ROADMAP.md) and [documentation map](docs/README.md).

## Development

Hanab Mobile uses **React Native, Expo, and TypeScript**. The hanab.live server is authoritative for game state; the client does not implement a separate game server.

You'll need Node.js 24, the Android SDK, and a device or emulator.

~~~bash
npm ci
npm run android
~~~

For type checking and automated tests:

~~~bash
npm run validate
~~~

To build a standalone release-variant APK locally (this regenerates the native Android project and may take a while):

~~~bash
npm run android:beta-apk
~~~

Release candidates and physical-device acceptance are tracked under [docs/](docs/README.md). GitHub Actions builds are separate from app-store signing and publishing.

## Credits and upstream

Hanab Mobile is an **unofficial community project**, not affiliated with or endorsed by hanab.live.

The project adapts portions of [Hanabi-Live](https://github.com/Hanabi-Live/hanabi-live). Upstream revisions and provenance are recorded in [docs/UPSTREAM.md](docs/UPSTREAM.md).

## License and third-party credits

Hanab Mobile is distributed under **[GNU GPLv3](LICENSE)** (`GPL-3.0-only`). The copyright of upstream code and artwork remains with its respective owners. See [third-party notices](THIRD_PARTY_NOTICES.md) for upstream attribution, bundled card/UI assets, and source-availability information for APK releases.
