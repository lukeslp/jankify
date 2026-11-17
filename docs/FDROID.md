# Jankify on F-Droid

Jankify is not in the F-Droid catalog. This page records what a catalog build
is, how to make one, and what is still open before a request can be filed.
The recipe draft is
[fdroid/metadata/com.lukesteuber.jankify.yml](../fdroid/metadata/com.lukesteuber.jankify.yml).

## What F-Droid would build

The Android app under `android/`: a Kotlin WebView shell around the editor and
the Create workspace, both stored in `android/app/src/main/assets/`. There is
one Android build for every channel.

- Application id `com.lukesteuber.jankify`, version from
  `android/app/build.gradle.kts`.
- No permissions. The app has no `INTERNET` permission and the bundled pages
  make no network requests.
- One dependency, `androidx.core:core-ktx`, from Google's Maven repository.
  No Google Play Services, Firebase, analytics or advertising code.
- No native code. The one checked-in binary is the Gradle wrapper.
- The bundled JavaScript is readable source. `scripts/sync-web.sh` writes the
  Android copy of the editor from `index.html`, and the tests fail if the
  committed copy is stale. Rough.js 4.6.6 is inlined in the editor as
  published.

## Build it the way F-Droid does

JDK 21, Android SDK platform 36 and build-tools 36.

```sh
cd android
./gradlew :app:testDebugUnitTest :app:assembleRelease
```

Without the four `JANKIFY_*` signing variables the result is
`android/app/build/outputs/apk/release/app-release-unsigned.apk`. The release
build leaves out the version-control file and the dependency metadata block,
so its bytes do not depend on how the source was checked out. CI runs this
build on every push and prints the file's SHA-256.

For F-Droid's reproducible-build check, sign that same unsigned file with the
Jankify release key and attach it to a GitHub release tagged
`android-v<version>` as `jankify-<version>.apk`. F-Droid rebuilds from the
tag, compares, and ships the signed file.

## Licenses

Jankify's own code and artwork are MIT (`LICENSE`). Bundled third-party code
is listed in `THIRD_PARTY_NOTICES.md`, with the license texts in `licenses/`
and on the app's Open-source licenses page: Rough.js (MIT) and the Deep-Fold
generators that the Create workspace builds on (MIT). The app bundles no
fonts and no photographs.

## Open before a request

1. Tag the release commit `android-v<version>` and publish a GitHub release
   with the signed file. The recipe's `commit` and `AllowedAPKSigningKeys`
   are zeros until then.
2. Put the recipe on a branch of the `fdroiddata` fork and let its pipeline
   run. The recipe has not been run through F-Droid's tools yet.
3. Phone screenshots. The listing has three tablet screenshots from the
   1.0.10 build and none from a phone.
4. Try this build on a device. Versions 1.0.12 and 1.0.13 were built from a
   different tree that still carried p5.js; 1.0.14 is the first build of
   those fixes without it.
