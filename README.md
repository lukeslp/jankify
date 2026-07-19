# Jankify

Jankify transforms photos into pixel art, Lite Brite boards, ASCII, emoji mosaics, hatching, rough sketches, polygons, and Voronoi art. The canonical browser app is `index.html`; native iOS and Android shells bundle synchronized offline copies.

## Web

Open `index.html` in a modern browser. No package installation or build step is required.

### Animated GIF

1. Upload an animated GIF (still images use PNG/SVG/etc. as usual).
2. The canvas shows the first frame; a sidebar note and header **GIF** button appear.
3. Choose Pixel, Lite Brite, ASCII, Emoji, Hatch, or Rough (Polygon and Voronoi are still-only).
4. Press **GIF**, pick a playback speed in the photosensitivity dialog, and wait while each frame is processed.
5. The looping result downloads in the browser, or opens the share sheet on iOS/Android.

Long GIFs are trimmed/downscaled for memory; frame delay is floored and checked against flash limits.

## Synchronize mobile web assets

After changing `index.html`, `Jankify/Resources/Web/offline.css`, or either native bridge, run:

```sh
./scripts/sync-web.sh
```

The script removes hosted fonts, icons, and analytics from mobile copies, adds the offline stylesheet, and injects the matching iOS or Android bridge.

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

## Android security and privacy

- The manifest requests no runtime or sensitive permissions, including no network or media-library permission.
- Only `index.html`, `offline.css`, and `android-bridge.js` are served from the private synthetic app origin.
- File and content URL access, cleartext traffic, mixed content, and untrusted in-WebView navigation are blocked.
- Web links open in the system browser.
- Photo selection uses Android's system document picker and reads only the selected image.
- Export MIME types, names, and decoded sizes are validated before cache-only sharing.
- Web local storage remains enabled and private to the app.

## Accessibility

The canonical interface uses semantic labels, visible keyboard focus, live status regions, light/dark themes, responsive layouts, reduced-motion handling, and a photosensitivity warning for animated output. The Android shell exposes the WebView as Jankify image editor, follows system font scaling up to 200%, supports pinch zoom, and preserves system picker and share-sheet accessibility.

## Author

Luke Steuber — [lukesteuber.com](https://lukesteuber.com) · [GitHub](https://github.com/lukeslp)

## License

MIT. See [LICENSE](LICENSE).
