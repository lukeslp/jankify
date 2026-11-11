# iOS release tools

These optional Fastlane lanes manage a store record you control. They are not needed for browser development or simulator tests.

Install [Fastlane](https://docs.fastlane.tools/#installing-fastlane), then configure credentials outside this repository:

- `JANKIFY_ASC_KEY_JSON`: path to a JSON file with `key_id`, `issuer_id`, and `key_filepath` for your App Store Connect API key.
- `JANKIFY_APP_IDENTIFIER`: your bundle identifier; defaults to `com.lukesteuber.jankify`.
- `JANKIFY_APPLE_ID` and `JANKIFY_TEAM_ID`: optional Apple account and developer-team values used by Fastlane.

Set the same bundle identifier and signing team in `project.yml` before building a fork. Never commit API-key files or signing credentials.

| Command | Effect |
|---|---|
| `fastlane ios status` | Reads the store record, builds and screenshot counts |
| `fastlane ios upload_listing` | Updates text metadata |
| `fastlane ios upload_shots` | Replaces screenshots |
| `fastlane ios stage` | Updates metadata and screenshots |
| `fastlane ios upload_build ipa:/path/to/Jankify.ipa` | Uploads a signed IPA |
| `fastlane ios attach_build build:NUMBER` | Selects a processed build for the editable version |
| `fastlane ios dedup_shots` | Deletes screenshots with duplicate filenames |

The upload lanes stop before review submission. Check the target record before running any lane that changes it. Screenshot origins and reproduction commands are in `screenshots/SOURCE.md`; `SUBMIT_CHECKLIST.md` covers final review.
