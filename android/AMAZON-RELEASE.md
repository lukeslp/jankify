# Amazon Appstore — Jankify (Fire tablet)

**Priority:** Fire tablet. There is no Fire TV build; Jankify is a touch-first
editor and creator with no D-pad navigation model.

## Intake and release track

| | |
|---|---|
| Product | Jankify |
| Maintainer | Luke Steuber |
| License | MIT |
| Application ID | `com.lukesteuber.jankify` |
| Candidate | `1.0.10 (17)` |
| minSdk / targetSdk | 26 / 36 |
| Source spine | Native Android shell with a bundled offline web editor |
| Permissions | no runtime or sensitive permissions |
| Required capability | `android.hardware.touchscreen` |
| Privacy | https://jankify.app/privacy.html |
| Listing pack | `amazon-listing/` |

Google Play Services is not linked. The APK contains no native libraries and
supports small, normal, large, and xlarge screens. minSdk 26 automatically
filters Fire OS 5 and 6; the tested Fire OS 8 tablet is API 30.

Track state: **submitted to Amazon Appstore on 2026-09-04 at 12:18 AM PDT**.
Amazon accepted the signed candidate, Fire-native listing pack, screenshots,
targeting, rating, privacy declaration, reviewer instructions, and export
certification. Luke confirmed the remaining physical-device checks were complete
before submission. Amazon estimated publication before 12:30 AM PDT on
2026-09-09.

## Why 1.0.10

The public direct-download channel already distributes `1.0.9 (16)`. The Fire
compatibility repairs therefore advance both identifiers instead of reusing a
published version number for different bytes.

The signed 1.0.9 binary exposed two Android 11 blockers on the physical Fire
tablet:

1. `MainActivity` resolved Android 13's `OnBackInvokedCallback` while the class
   loaded and crashed before first paint.
2. The bundled-asset allowlist used a Java 10 `URLDecoder` overload unavailable
   on Android 11; its guarded failure rejected every local file and produced
   `ERR_HTTP_RESPONSE_CODE_FAILURE`.

Both failures now have instrumentation coverage in `LegacyLaunchTest` and pass
on KFRASWI.

## Official Amazon requirements snapshot

Sources retrieved 2026-09-03:

- [Device filtering and compatibility](https://developer.amazon.com/docs/app-submission/device-filtering-and-compatibility.html)
- [Manifest filters supported by Amazon Appstore](https://developer.amazon.com/docs/app-submission/supported-filters-on-the-amazon-appstore.html)
- [Amazon Appstore test criteria](https://developer.amazon.com/docs/app-testing/test-criteria.html)
- [Appstore Details image requirements](https://developer.amazon.com/docs/app-submission/appstore-details.html#images-and-videos)
- [Fire tablet performance test scripts](https://developer.amazon.com/docs/app-testing/app-performance-scripts-fire-tablet.html)

The explicit required touchscreen keeps this touch-first interface away from
Fire TV. Amazon's tablet test criteria require a clean launch, correct Back and
Home behavior, unobstructed soft keys, state retention through hibernation,
stable network interruption behavior when applicable, and a functional layout
in both orientations. Jankify's core flow is offline, so network interruption
does not gate editing.

## Build signed release

```sh
cd /Users/luke/workspace/android-release-toolkit
scripts/android-release with-signing --profile jankify -- \
  /Users/luke/workspace/jankify-ios/scripts/stage-android-release.sh
```

Before staging, run `./scripts/sync-web.sh`, all three JavaScript bridge and
animation test files, and Gradle `:app:testDebugUnitTest :app:lintDebug`. The
staging script then refuses missing signing inputs, reruns the Android unit
tests, builds APK and AAB packages, verifies signatures, and writes versioned
files to `dist/android/v1.0.10/`. It never uploads or publishes anything.

## Device gate — Fire tablet

Use the exact signed candidate and record the APK SHA-256.

1. Clean-install and launch from the app library without an error page.
2. Confirm Edit and Create both render and switch without losing their state.
3. Import a non-personal image through the system picker; try Pixel, Lite
   Brite, ASCII, Emoji, Hatch, Rough, Polygon, and Voronoi.
4. Export at least PNG, SVG or text, and one animated format through the system
   share sheet; confirm cancel returns safely.
5. Create a starscape and one other seeded scene; regenerate and export it.
6. Exercise Back, Home/resume, sleep/wake, and a cold relaunch.
7. Rotate portrait → landscape → portrait. Confirm controls reflow, state
   survives, and no content sits beneath Fire's system bars.
8. Enable VoiceView and traverse the workspace switcher, import control, mode
   tabs, sliders, export controls, and status updates. Verify visible focus and
   usable names, roles, values, and state announcements.
9. Confirm pinch zoom works, tap targets remain separated, and no core action
   depends only on a drag or long press.
10. Run a 30-minute editor/Create soak and watch for crashes, ANRs, persistent
    frame drops, or excessive storage writes.

### Current evidence — 2026-09-03

- **Measured:** KFRASWI (`raspite`), Fire OS 8.3.3.8 / Android 11 (API 30),
  800×1280 native, arm64-v8a, real multitouch, Amazon WebView 148.
- **Measured:** signed `1.0.9 (16)` installed, but failed both launch and local
  asset loading as described above.
- **Measured:** `LegacyLaunchTest` reproduced each failure on that device and
  both tests pass after the fixes.
- **Measured:** current signed `1.0.10 (17)` APK SHA-256
  `036acfcef18435a27dd5796091a373c80c488c8b0f19de157e0bc36bb4fb0648`;
  APK Signature Scheme v2 verifies against certificate SHA-256
  `0a28c56f0be561ce3e64db365f1f7d83a0d0c4bbad27a15963d171805ca2c8e6`.
- **Measured:** current signed AAB SHA-256
  `e67c7593860c6f1033ed134e1562de2224cf2564834cee5644003691da1620a4`.
- **Measured:** 50 cold starts completed in 545–614 ms first-frame time
  (median 572 ms, p95 602 ms). Ten fully-drawn samples completed in 722–853 ms
  (median 819 ms), after the bundled editor document was ready.
- **Memory:** five foreground PSS samples ranged from 72,419–78,179 KB
  (median 72,419 KB), far below Amazon's 1,600 MB foreground ceiling.
- **Measured:** clean signed install and 614 ms cold launch with no crash or
  error page. Edit imported the checked-in, non-personal Jankify icon through
  Fire's document picker and rendered a 1000×1000 Pixel result.
- **Measured:** Pixel PNG and CSS exports reached Fire's share sheet and cancel
  returned safely. Create generated distinct starscape and planet scenes.
- **Measured:** Home/resume, sleep/wake, portrait/landscape rotation, and Back
  navigation all completed. Imported editor state survived Home, wake, and
  both rotations; Back traversed the in-app history and then returned to the
  Fire launcher.
- **Measured:** all four Android instrumentation tests pass on KFRASWI,
  including both Android 11 launch regressions and actual on-screen system-bar
  clearance. The fourth test proves Edit and Create are present in Android's
  accessibility service tree. Twelve bridge/animation host tests, Android unit
  tests, and `lintDebug` also pass.
- **Accessibility evidence:** with Fire OS VoiceView enabled, the signed app
  exposed the Edit/Create switcher, media picker, mode selector, export actions,
  sliders and values, status region, and the effect list. The setting was
  restored after the audit; spoken output and per-effect focus behavior remain
  human acceptance checks.
- **Store behavior:** the direct-download update checker was removed. The
  candidate remains fully offline and requests no Internet permission.
- **Measured:** three native 1280×800 signed-build screenshots are ready:
  `01_starscape-1280x800.png`, `02_planet-1280x800.png`, and
  `03_pixel-edit-1280x800.png`. The later native-only fully-drawn and update
  checker changes do not alter their visible content.
- **Amazon record:** app ID
  `amzn1.devportal.mobileapp.0700f7a5e3ad43bab763732fe4b4fee4`, release ID
  `amzn1.devportal.apprelease.484a6b5eeebc46259311f4819b943181`, SKU
  `jankify-fire`. Amazon selected 12 Fire tablets and no Fire TV or Automotive
  devices.
- **Submission:** successful at 12:18 AM PDT on 2026-09-04. Amazon estimated
  publication before 12:30 AM PDT on 2026-09-09.

## Amazon update sequence

1. Build and re-run the Fire tablet gates against the exact signed update.
2. Upload the new APK to the existing Amazon record; keep the Fire-tablet-only
   device boundary and inspect the generated supported-device list.
3. Update listing copy or assets from `amazon-listing/` when they change.
4. Reconfirm rating, audience, availability, privacy, user-data, reviewer, and
   export-compliance answers before submitting an update.
