# Fire tablet development

Jankify targets touch-driven Android phones and tablets. The manifest requires a touchscreen; the app does not provide a Fire TV remote-control interface. Google Play Services is not linked. Current SDK and version settings are in `app/build.gradle.kts`.

## Build

Use the root README's Android debug-build commands. For a signed build with your own identity, set the four `JANKIFY_*` signing variables and run `scripts/stage-android-release.sh` from the repository root. Configure `ANDROID_HOME` if your SDK is outside the default macOS location.

## Compatibility checks

`LegacyLaunchTest` covers two earlier Android 11 regressions: resolving an Android 13 Back-navigation class during startup, and using a newer `URLDecoder` overload while resolving bundled files. Preserve these checks when changing startup or local asset handling.

Use a representative Fire tablet and record the exact APK hash and OS version:

1. Install and launch without an error page. Try Edit and Create.
2. Import an original or public-domain image through the system picker. Try all eight Edit modes.
3. Export PNG, SVG or text, and an animated format. Cancel the share sheet and confirm the app remains usable.
4. Generate and export Backgrounds, Starscapes, and a second seeded scene.
5. Exercise Back, Home/resume, sleep/wake, cold launch, and both orientations.
6. Enable VoiceView and check the workspace switcher, picker, mode tabs, sliders, exports and status updates. Check pinch zoom and large text.
7. Run a sustained editing/Create session and observe memory, crashes, responsiveness and storage use.

Use the current [Amazon testing guidance](https://developer.amazon.com/docs/app-testing/test-criteria.html) and [device filtering guidance](https://developer.amazon.com/docs/app-submission/device-filtering-and-compatibility.html) for store submission requirements. Screenshots in `amazon-listing/` retain their capture provenance in `amazon-listing/ASSET-MAP.md`; they are not proof that a newly built APK passed these checks.
