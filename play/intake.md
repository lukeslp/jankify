# Jankify Google Play intake

- Product: Jankify current source 1.0.10 (`versionCode 17`)
- Maintainer: Luke Steuber
- License: MIT
- Package: `com.lukesteuber.jankify`
- Source: native Android shell containing the synchronized offline web editor
- Targets: Android phones and tablets
- Current track state: `historical-artifact-staged`; fresh Play handoff required
- Play record: confirmed absent from developer account `6919353697792485209`
  on 2026-07-20; the account contained only `one.whatcoloristhis.twa`
- Established signer SHA-256: `0A:28:C5:6F:0B:E5:61:CE:3E:64:DB:36:5F:1F:7D:83:A0:D0:C4:BB:AD:27:A1:59:63:D1:71:80:5C:A2:C8:E6`

## Evidence and blockers

- The account is personal, has no publishing service account invited, and
  currently requires at least 12 opted-in closed-test users for at least 14 days
  before production access.
- `com.lukesteuber.jankify` is not yet registered under Android developer
  verification.
- Android configuration is 1.0.10 (17), min SDK 26, target SDK 36.
- Release-signed APK and AAB artifacts for 1.0.7 (14) remain verified and staged
  under `artifacts/google-play/com.lukesteuber.jankify/1.0.7-14/`, but are an
  immutable historical shelf rather than the current upload candidate.
- Existing store metadata and screenshots are iOS-specific.
- The privacy policy refers to the iOS picker/share sheet and must be made platform-neutral before Play submission.
- The direct-update checker has been removed from Android; the store build and
  no-Internet privacy claim now agree.

## Accessibility and device gates

Before advancing to `device-tested`, record:

- Photo, animated GIF, and supported video selection and export.
- Picker and share-sheet behavior plus storage/cache cleanup.
- TalkBack labels and focus order, keyboard/switch alternatives, 200% text/display scaling, touch targets, reduced motion, and photosensitivity warnings.
- Long-media memory limits, cancellation, and background/foreground recovery.

## Next route

Do not upload the historical 1.0.7 shelf as the current release. Before a Play
upload, stage a fresh toolkit handoff from 1.0.10 (17), complete the device and
accessibility checks, correct and deploy the privacy policy, and prepare the
Android store pack in `play/README.md`.
