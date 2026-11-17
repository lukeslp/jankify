# Changelog

## Unreleased

### Android 1.0.14 (21)

- A licenses page for the bundled open-source code, linked from the controls.
- Back closes dialogs and cancels a running animated export before it leaves
  the app.
- 48 dp touch targets and names for screen readers.
- The Android page says Open, File and share where the web page says upload
  and download, and calls the peg mode Peg Board.
- The release APK leaves out the version-control file and the dependency
  metadata block, so a clean clone builds the same bytes. See
  [docs/FDROID.md](docs/FDROID.md).

### Fixed

- The flashing check before animated exports now follows the WCAG 2.3.1
  definition (a pair of opposing luminance changes, darker frame below 0.80).
- The Random, Sheet and Video buttons show their icons in the iOS and Android
  apps. The bundled icon fallbacks had no entry for them, so each button had a
  blank gap. The empty editor's mode list wraps between names, and the status
  line says when the system's reduced-motion setting turns animated export off.
- The Background checkbox has a name for screen readers.
- Removed the ineffective direct-download update checker from Android. The app
  intentionally requests no Internet permission, so the checker could never
  complete and does not belong in an Amazon or Play build.
- Seeded effects and explosions now vary their geometry, motion, details, and debris instead of repeating one shape with different colors.
- The header App Store button is hidden inside the iOS and Android apps; it only renders on the web.
- GIF LZW decode/encode code-size growth now matches the GIF89a bit-width rules, so Make GIF works on real third-party GIFs (not only self-encoded round-trips).
- Native shells sniff GIF magic bytes and name the imported file `*.gif`, so the GIF export button appears on iOS the same way it does on Android/web.
- GIF photosensitivity warning no longer blocks app launch on Android/iOS WebViews (`hidden` vs inline `display:flex`).

### Added

- iPhone Duo book pose: with the inner screen half open and the fold running
  down the middle, the editor's controls take the left page and the canvas
  takes the right, with nothing tappable on the fold. Flat-open and the folded
  outer screen keep their existing layouts.
- `scripts/capture-duo.sh` captures iPhone Duo App Store screenshots without
  taps, using Debug-only launch arguments that open a bundled sample image.
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
