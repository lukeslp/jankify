# Jankify 1.0 — submission checklist

Everything that can be pushed from the command line is automated by the lanes in
`fastlane/Fastfile`. A few fields can only be set in the App Store Connect web UI;
they are the short list below. The app record already exists
(`com.lukesteuber.jankify`, Apple ID 6782693852).

## Pushed automatically (see Fastfile)

- `bundle exec fastlane upload_listing` — name, subtitle, promo text, description,
  keywords, release notes, marketing/support/privacy URLs, copyright, categories.
- `bundle exec fastlane upload_shots` — 6 iPhone 6.9" + 5 iPad 13" screenshots.
- `bundle exec fastlane stage` — both of the above at once, leaves the version
  staged with **no** review submission.

Auth first: `source ~/.appstoreconnect/env.sh`.

## Build

- Build **5** (marketing version 1.0.0) is uploaded via the central ASC API key.
- Builds 1–4 already existed on the record; 5 supersedes them.
- After upload, the build takes ~5–30 min to finish processing before it can be
  attached to the 1.0 version. Attach it under **App Store → 1.0 → Build**.

## Set once in the App Store Connect UI

These are not reliably settable through `deliver`, so do them in the browser:

1. **Age rating** → 4+ (no objectionable content in any category).
2. **Pricing** → Free (Availability: all territories).
3. **App Privacy** → "Data Not Collected" (the app makes no network calls and
   has no analytics). Privacy policy URL is already set to
   `https://dr.eamer.dev/jankify/privacy.html`.
4. **Encryption** → already declared exempt in Info.plist
   (`ITSAppUsesNonExemptEncryption = false`); no extra step.

## App Review information (set in the UI — needs your phone number)

`deliver` can't set the review contact without a valid phone number, so add it
in **App Store → App Review Information**: first name, last name, your phone
(format `+1 555 123 4567`), and `luke@lukesteuber.com`. No demo account is
needed. Paste this into the **Notes** field:

> Jankify runs entirely on-device with no account, login, network calls, or
> special configuration. To review: tap Choose an image, pick any photo, choose
> a mode from the Mode menu (Pixel, Lite Brite, ASCII, Emoji, Hatch, Rough,
> Polygon, Voronoi), adjust the sliders, then export with PNG / SVG / Copy. No
> data is collected. The tagline "without AI" is the product brand.

## Before tapping Submit for Review

- [ ] Deploy the website so the privacy page is live: commit + push, confirm
      `https://dr.eamer.dev/jankify/privacy.html` returns the real policy
      (currently the path falls back to the app until `privacy.html` is deployed).
- [ ] Confirm build 5 is attached to the 1.0 version.
- [ ] Age rating, pricing, and App Privacy set per above.
- [ ] Review the 11 screenshots and the description in the listing preview.

Then **Submit for Review** is the only remaining click.
