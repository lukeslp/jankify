fastlane documentation
----

# Installation

Make sure you have the latest version of the Xcode command line tools installed:

```sh
xcode-select --install
```

For _fastlane_ installation instructions, see [Installing _fastlane_](https://docs.fastlane.tools/#installing-fastlane)

# Available Actions

## iOS

### ios upload_listing

```sh
[bundle exec] fastlane ios upload_listing
```

Push text metadata only (no binary, no screenshots). Safe, no review.

### ios upload_shots

```sh
[bundle exec] fastlane ios upload_shots
```

Push screenshots only (device class inferred from pixel dimensions).

### ios stage

```sh
[bundle exec] fastlane ios stage
```

Push metadata + screenshots, leave the version staged (NO submit).

### ios upload_build

```sh
[bundle exec] fastlane ios upload_build
```

Upload a signed IPA to App Store Connect without distributing it.

### ios attach_build

```sh
[bundle exec] fastlane ios attach_build
```

Attach a processed build to the editable App Store version.

### ios dedup_shots

```sh
[bundle exec] fastlane ios dedup_shots
```

Delete duplicate screenshots (same filename) left by flaky-API re-uploads.

### ios status

```sh
[bundle exec] fastlane ios status
```

Print the current App Store listing state (version, name, screenshot counts).

----

This README.md is auto-generated and will be re-generated every time [_fastlane_](https://fastlane.tools) is run.

More information about _fastlane_ can be found on [fastlane.tools](https://fastlane.tools).

The documentation of _fastlane_ can be found on [docs.fastlane.tools](https://docs.fastlane.tools).
