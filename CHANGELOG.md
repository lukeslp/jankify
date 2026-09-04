# Changelog

## Unreleased

### Fixed

- Removed the ineffective direct-download update checker from Android. The app
  intentionally requests no Internet permission, so the checker could never
  complete and does not belong in an Amazon or Play build.
- Seeded effects and explosions now vary their geometry, motion, details, and debris instead of repeating one shape with different colors.
- The header App Store button is hidden inside the iOS and Android apps; it only renders on the web.
- GIF LZW decode/encode code-size growth now matches the GIF89a bit-width rules, so Make GIF works on real third-party GIFs (not only self-encoded round-trips).
- Native shells sniff GIF magic bytes and name the imported file `*.gif`, so the GIF export button appears on iOS the same way it does on Android/web.
- GIF photosensitivity warning no longer blocks app launch on Android/iOS WebViews (`hidden` vs inline `display:flex`).

### Added

- A signed Fire-tablet candidate, required-touchscreen manifest filter,
  Fire-native Amazon listing pack, and three 1280×800 device screenshots.
- Android's fully-drawn signal after the bundled editor is ready, with repeated
  first-frame and ready-to-use measurements on Fire OS 8.
- A physical-device regression test proving the Edit/Create workspace switcher
  appears in the accessibility service tree.
- A fully bundled Create workspace on iOS and Android with seven SpaceJank generators, offline recipe navigation, native PNG sharing, and public recipe-link copying.
- An in-app Edit/Create switcher across the editor and creator.
- Local MP4, MOV, M4V, and WebM import with bounded duration and frame sampling.
- Animated GIF, PNG sprite-sheet, and processed-video exports from GIF or video sources.
- Configurable animation duration, frame rate, sheet columns, and detailed progress feedback.
- Native iOS and Android media picking and animation-export sharing.
- Offline Android WebView shell targeting API 36 and JDK 21.
- System photo picker, native share/export, and clipboard bridge behavior.
- Strict local-asset origin, navigation, MIME, filename, and payload-size controls.
- Android unit tests and JavaScript bridge tests.
- Optional environment-only release signing and versioned APK/AAB checksum staging.
- Gradle 8.14.5 wrapper and Android build documentation.

### Changed

- Native Create opens on the Effects generator and remains inside the app when switching workspaces.
- Mobile web synchronization now generates both iOS and Android bundles from canonical `index.html`.
- Offline typography and icon fallbacks are shared across both native bundles.

### Security

- Android requests no permissions and blocks file access, content access, mixed content, cleartext traffic, and untrusted WebView navigation.
- Shared exports are confined to the private cache and granted through temporary content URIs.
