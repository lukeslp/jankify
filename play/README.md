# Jankify Google Play bootstrap

Google Play login, record creation, signing enrollment, upload, declarations, rollout, and publication are human gates.

## Confirm the record first

Search the existing Play Console account for exact package `com.lukesteuber.jankify`.

- If it exists, record its state and signing fingerprints before changing anything.
- If it does not exist, create **Jankify** manually after the working tree and Play build behavior are resolved.
- Preserve direct-install upgrade continuity by importing the established release key as the Play app-signing key through Google's protected flow.

## Engineering gates

- [ ] Resolve or commit the four pre-existing working-tree changes without mixing them into Play setup.
- [ ] Add a Play release behavior that disables direct-download update prompts.
- [ ] Make the privacy policy platform-neutral and accurate for Android.
- [ ] Build, stage, sign, and checksum version 1.0.6 (13) with the established identity.
- [ ] Inspect package, version, target SDK, permissions, embedded SDKs, and signatures.
- [ ] Complete the device/accessibility checks in `play/intake.md`.

## Store listing to stage

- [ ] Adapt the existing description to Android and remove iPhone/iPad-only wording.
- [ ] Review a 512 × 512 Play icon from the existing icon sources.
- [ ] Create an opaque 1024 × 500 feature graphic.
- [ ] Capture real Android phone and tablet screenshots for still-image effects, animated media, controls, and export.
- [ ] Add captions and alt text for every image.
- [ ] Prepare privacy URL, contact details, category/tags, and Internal testing release notes.
- [ ] Complete ads, app access, target audience, content rating, Data safety, countries, and pricing decisions.

## First Console pass

1. Confirm or create the exact package record.
2. Resolve Play App Signing before uploading the first bundle.
3. Complete listing and App content forms from reviewed evidence.
4. Upload the verified current AAB to Internal testing.
5. Test the Play-delivered build on representative Android devices.
6. Keep review and production submission as explicit human actions.
