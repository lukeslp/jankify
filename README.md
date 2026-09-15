# Jankify

Jankify turns photos and short clips into pixel art, Lite Brite boards, ASCII, emoji mosaics, hatching, rough sketches, polygons, and Voronoi art. Its Create workspace generates seeded backgrounds, starscapes, planets, sprites, ships, effects, and explosions.

Image processing runs locally. The repository includes the browser app and offline iOS and Android shells.

## Run in a browser

From the repository root:

```sh
python3 -m http.server 5058
```

Open [localhost:5058](http://localhost:5058). Use **Create** to open the generators and **Edit** to return to the photo editor. No package installation or JavaScript build step is required. Serve the whole directory: Create uses browser modules, which require HTTP rather than a `file://` URL.

The browser editor loads hosted fonts and icons; processing does not upload media. Native bundles replace those resources with local styles. Browser recipe links retain the current host and path. Native copies link to `https://jankify.app/create/app/`, adding `embed=false` for Backgrounds so the hosted app selects its matching canvas renderer. Hosted and installed versions can change independently; use PNG export when exact output matters. A fork can change `PUBLIC_CREATE_URL` in `scripts/assets/spacejank-recipes.mjs` and regenerate its bundles.

### Animated media

1. Upload a GIF or browser-readable video, such as MP4, MOV, or WebM.
2. Choose Pixel, Lite Brite, ASCII, Emoji, Hatch, or Rough. Polygon and Voronoi handle still images.
3. Choose a duration, frame rate, and sprite-sheet layout.
4. Export a looping GIF, PNG sprite sheet, or recorded video. Video export depends on browser support.

Long sources are trimmed and downscaled. Animation controls include duration, frame-count, and flash limits, plus a photosensitivity warning.

## Source and generated files

| Edit here | Purpose |
|---|---|
| `index.html` | Browser photo editor, shared rendering logic and inline Rough.js |
| `Jankify/Resources/Web/create/` | Tracked Create source snapshot, including generators and source attribution |
| `scripts/assets/spacejank-backgrounds.js` | Backgrounds canvas renderer, copied into Create during synchronization |
| `scripts/assets/spacejank-recipes.mjs` | Local browser recipe URLs and native public-link adapter |
| `Jankify/Resources/Web/offline.css` | Local mobile typography and icon fallbacks |
| `Jankify/Resources/Web/ios-bridge.js` | iOS picker, export and clipboard adapter |
| `android/app/src/main/assets/android-bridge.js` | Android adapter |
| `project.yml` | iOS project settings; regenerate with XcodeGen |

After changes, run:

```sh
./scripts/sync-web.sh
node --test JankifyTests/*.test.js
```

Synchronization generates both mobile editor pages, root `create/`, and Android's Create copy from tracked files. It also copies third-party notices into the mobile bundles. Commit generated changes alongside their source. No adjacent checkout or network connection is needed for this step.

Create's Backgrounds mode uses the included seeded night-sky and mountain renderer. It differs from the older upstream watercolor painter. The seven modes remain available; the older painter and p5.js are not bundled. See [third-party notices](THIRD_PARTY_NOTICES.md) for source origins and output terms.

### Optional upstream refresh

Normal builds use the included snapshot. Maintainers with an upstream PixelGen checkout can deliberately import a reviewed commit:

```sh
SPACEJANK_SOURCE=/path/to/PixelGen \
SPACEJANK_REVISION=da5ddb2eb810f35e2949b35eafec6332d549954b \
  ./scripts/sync-spacejank.sh
./scripts/sync-web.sh
```

The importer requires a clean checkout, copies committed files from an explicit allowlist, records the revision, and applies Jankify's native bridge and Backgrounds adaptation. Review upstream changes and licensing before updating the pinned snapshot.

## iOS

Use Xcode with an iOS 17 or later SDK and XcodeGen. Choose an installed simulator in the destination argument:

```sh
./scripts/sync-web.sh
xcodegen generate
xcodebuild test \
  -project Jankify.xcodeproj \
  -scheme Jankify \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro' \
  CODE_SIGNING_ALLOWED=NO
```

For a physical device, select your own development team and bundle identifier in `project.yml`, then regenerate the project. Release signing credentials are not required for simulator tests.

## Android

Requirements: JDK 21, Android SDK Platform 36, and Build Tools 36. The Gradle 8.14.5 wrapper is included. Set `ANDROID_HOME` to your SDK or configure `android/local.properties` locally.

```sh
./scripts/sync-web.sh
cd android
./gradlew :app:testDebugUnitTest :app:assembleDebug
```

The debug APK appears in `android/app/build/outputs/apk/debug/`. Debug builds use a separate application ID and do not require release credentials. Gradle downloads build dependencies on first use.

For your own signed release, set `JANKIFY_STORE_FILE`, `JANKIFY_STORE_PASSWORD`, `JANKIFY_KEY_ALIAS`, and `JANKIFY_KEY_PASSWORD` in the process environment, then run `./scripts/stage-android-release.sh`. It builds and verifies an APK and AAB and writes versioned files with checksums under `dist/android/`. It does not upload or publish them.

## Privacy and accessibility

The native apps bundle both workspaces and use system file pickers and share sheets. Android requests no network or media-library permission. Native bridges validate exported MIME types, filenames and sizes; web links open in the system browser. Browser recipes and native history are stored locally.

The interfaces include semantic labels, visible keyboard focus, status announcements, responsive layouts, reduced-motion handling, and animation warnings. The native shells support system font scaling, pinch zoom, and accessible system pickers and share sheets.

## Contributing

Keep rendering changes in the shared source and regenerate native copies. Include the Node tests above with changes to codecs, animation limits, or bridges; run the relevant native tests when changing shell behavior. Describe how to reproduce visual changes and include the browser or device you used. Keep signing keys, local settings, and private test media out of commits.

## Author and license

Luke Steuber — [lukesteuber.com](https://lukesteuber.com) · [GitHub](https://github.com/lukeslp)

Jankify's original code is [MIT licensed](LICENSE). Bundled libraries and adapted generators retain their own notices; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Source publication does not change any installed app or store release.
