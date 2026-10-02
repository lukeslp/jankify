# Jankify

Jankify creates seeded pixel-art space scenes and transforms photos into pixel art, Lite Brite boards, ASCII, emoji mosaics, hatching, rough sketches, polygons, and Voronoi art. The canonical browser editor is `index.html`; native iOS and Android shells bundle synchronized offline copies of both workspaces.

The Edit/Create workspace switcher joins the photo editor with seven SpaceJank generators: backgrounds, starscapes, planets, sprites, ships, effects, and explosions. Both workspaces stay inside the native apps and run without a network connection. Public recipe links use `https://jankify.app/create/` so someone opening a shared recipe can reproduce it on the web.

## Web

Open `index.html` in a modern browser. No package installation or build step is required.

### Animated media

1. Upload an animated GIF or browser-readable video such as MP4, MOV, or WebM.
2. The canvas shows the first frame; animation controls and export buttons appear.
3. Choose Pixel, Lite Brite, ASCII, Emoji, Hatch, or Rough (Polygon and Voronoi are still-only).
4. Choose a duration, frame rate, and sprite-sheet layout, then export a looping GIF, PNG sprite sheet, or recorded video.
5. The result downloads in the browser, or opens the native share sheet on iOS/Android.

Long sources are trimmed and downscaled for memory. Frame timing is bounded and checked against flash limits, and progress remains visible during decoding, rendering, and encoding.

## Synchronize mobile web assets

After changing `index.html`, `Jankify/Resources/Web/offline.css`, or either native bridge, run:

```sh
./scripts/sync-web.sh
```

The script removes hosted fonts, icons, and analytics from mobile copies, adds the offline stylesheet, injects the matching iOS or Android bridge, and mirrors the pinned Create bundle. To update Create from its upstream checkout first, run `./scripts/sync-spacejank.sh` and then `./scripts/sync-web.sh`.

## iOS

Requirements: Xcode with an iOS 17+ simulator and XcodeGen.

```sh
./scripts/sync-web.sh
xcodegen generate
xcodebuild test \
  -project Jankify.xcodeproj \
  -scheme Jankify \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro'
node --test JankifyTests/ios-bridge.test.js
```

## Android

Android builds are distributed directly from the project download page. Release
artifacts use the established Jankify signing identity and are verified before
publication.

The current signed release is Jankify 1.0.10 (17) for Android, on its
[download page](https://dr.eamer.dev/downloads/apps/jankify/) with SHA-256
checksums. The site's Android button links to that page, so it stays current.
1.0.9 crashes on Android 12 and earlier; its file remains at
jankify.app/downloads/android/ only for existing links.

Requirements:

- Android SDK Platform 36 and Build Tools 36
- JDK 21
- The included Gradle 8.14.5 wrapper

Build and test:

```sh
./scripts/sync-web.sh
cd android
./gradlew :app:testDebugUnitTest :app:assembleDebug
cd ..
node --test JankifyTests/android-bridge.test.js
```

The debug APK is written under `android/app/build/outputs/apk/debug/`.

### Signed release staging

Release credentials are read only from the process environment:

- `JANKIFY_STORE_FILE`
- `JANKIFY_STORE_PASSWORD`
- `JANKIFY_KEY_ALIAS`
- `JANKIFY_KEY_PASSWORD`

With those variables set, run:

```sh
./scripts/stage-android-release.sh
```

The script tests and builds the signed APK and AAB, verifies both signatures, and stages versioned copies plus `SHA256SUMS` under `dist/android/vVERSION/`. It does not install, upload, or publish anything.

### Amazon Fire tablet

The signed `1.0.10 (17)` Fire-tablet build was submitted to Amazon on
2026-09-04 for 12 compatible tablets. Amazon estimated publication before
2026-09-09 at 12:30 AM PDT. Its APK SHA-256 is
`036acfcef18435a27dd5796091a373c80c488c8b0f19de157e0bc36bb4fb0648`.
The Amazon listing pack, measured launch/memory evidence, submission record,
and update sequence are in
[`android/AMAZON-RELEASE.md`](android/AMAZON-RELEASE.md).

This does not change the public direct-download channel: `1.0.9 (16)` remains
the served release until a separate direct publication is verified.

## Android security and privacy

- The manifest requests no runtime or sensitive permissions, including no network or media-library permission.
- Store builds do not invoke the retired direct-download update checker.
- Only allowlisted editor and Create assets are served from the private synthetic app origin.
- File and content URL access, cleartext traffic, mixed content, and untrusted in-WebView navigation are blocked.
- Web links open in the system browser.
- Media selection uses Android's system document picker and reads only the selected image or video.
- Export MIME types, names, and decoded sizes are validated before cache-only sharing.
- Web local storage remains enabled and private to the app.
- Android reports the app fully drawn after the bundled editor document is
  ready, so ready-to-use latency is observable in device logs.

## Accessibility

The canonical interfaces use semantic labels, visible keyboard focus, live status regions, responsive layouts, reduced-motion handling, and a photosensitivity warning for animated output. The native shells expose the WebView as the Jankify editor and creator, follow system font scaling, support pinch zoom, and preserve system picker and share-sheet accessibility.

## Author

Luke Steuber — [lukesteuber.com](https://lukesteuber.com) · [GitHub](https://github.com/lukeslp)

## License

MIT. See [LICENSE](LICENSE).
