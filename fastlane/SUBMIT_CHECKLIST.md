# Jankify 1.1.3 — release checklist

The App Store record already exists (`com.lukesteuber.jankify`, Apple ID
6782693852). These steps stage build 60 and its listing without submitting the
release for review.

## Automated staging

- `fastlane ios upload_listing` pushes the text metadata and the canonical
  `jankify.app` URLs.
- `fastlane ios upload_shots` replaces the screenshots with 5 iPhone 6.9-inch
  and 5 iPad 13-inch screenshots.
- `fastlane ios stage` performs both operations and leaves the version staged
  with no review submission.
- `fastlane ios upload_build ipa:/path/to/Jankify.ipa` uploads the signed
  1.1.3 (60) build without distributing it. Allow time for Apple to process it.
- `fastlane ios attach_build build:60` pairs the processed build with version
  1.1.3 without submitting it for review.

## App Store Connect checks

- [ ] Confirm version 1.1.3 and build 60 are paired under **App Store → 1.1.3**.
- [ ] Confirm the age rating remains 4+ and the app remains free in all intended
      territories.
- [ ] Confirm App Privacy remains **Data Not Collected**.
- [ ] Confirm `https://jankify.app/privacy.html` is the privacy policy URL.
- [ ] Confirm the review contact is complete. No demo account is required.
- [ ] Review all 10 screenshots, the description, and the release notes in the
      listing preview.

Use this review note if the existing one needs to be refreshed:

> Jankify runs entirely on-device with no account, login, network calls, or
> special configuration. Use the Edit/Create switcher to try either workspace.
> In Create, choose any generator and tap New piece. In Edit, tap Choose media,
> pick any photo, choose a mode, adjust the controls, then export or share the
> result. No data is collected.

Submit for review only after every check above is complete.
