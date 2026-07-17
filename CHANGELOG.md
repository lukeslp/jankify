# Changelog

## Unreleased

### Fixed

- GIF photosensitivity warning no longer blocks app launch on Android/iOS WebViews (`hidden` vs inline `display:flex`).

### Added

- Offline Android WebView shell targeting API 36 and JDK 21.
- System photo picker, native share/export, and clipboard bridge behavior.
- Strict local-asset origin, navigation, MIME, filename, and payload-size controls.
- Android unit tests and JavaScript bridge tests.
- Optional environment-only release signing and versioned APK/AAB checksum staging.
- Gradle 8.14.5 wrapper and Android build documentation.

### Changed

- Mobile web synchronization now generates both iOS and Android bundles from canonical `index.html`.
- Offline typography and icon fallbacks are shared across both native bundles.

### Security

- Android requests no permissions and blocks file access, content access, mixed content, cleartext traffic, and untrusted WebView navigation.
- Shared exports are confined to the private cache and granted through temporary content URIs.
