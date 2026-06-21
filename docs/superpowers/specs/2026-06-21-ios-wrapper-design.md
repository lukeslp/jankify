# Jankify iOS Wrapper Design

## Goal

Ship Jankify as an offline-first iPhone and iPad app. The app must run the existing browser image-processing pipeline entirely on-device while using native iOS surfaces for image selection, sharing, file export, and clipboard access.

## Architecture

The app is a small SwiftUI shell around `WKWebView`, generated with XcodeGen from `project.yml`. A bundled `Resources/Web` directory contains a synchronized snapshot of the repository frontend. `WKWebView.loadFileURL` grants read access only to that directory, and normal operation requires no server or network connection.

The hosted frontend remains the canonical implementation. `scripts/sync-web.sh` refreshes the bundled snapshot and applies app-only resources without mixing iOS bridge behavior into the deployed page. Current CDN font and icon dependencies are replaced or bundled in the app snapshot so offline rendering is complete.

## Native Bridge

An injected `ios-bridge.js` communicates through one `WKScriptMessageHandler`. Messages use a small typed envelope with an action and payload:

- `pickImage` presents `PhotosPicker`; Swift returns the selected image as a data URL to JavaScript, which passes it to the existing file-loading pipeline.
- `share` accepts a filename, MIME type, and encoded payload, writes a temporary file, and presents `UIActivityViewController`.
- `copyText` writes exported text to `UIPasteboard` and reports success or failure to the page.

The bridge validates action names, MIME types, payload sizes, and filenames. Temporary export files are replaced predictably and remain inside the app container. Browser behavior stays unchanged because the bridge script exists only in the bundled app resources.

## Project Structure

- `Jankify/`: SwiftUI entry point, web view, bridge coordinator, and assets.
- `Resources/Web/`: synchronized offline frontend plus the app-only bridge script.
- `JankifyTests/`: message decoding and resource-loading tests.
- `JankifyUITests/`: launch smoke test confirming the bundled interface appears.
- `scripts/sync-web.sh`: deterministic frontend snapshot refresh.
- `project.yml`: canonical XcodeGen configuration; generated `.xcodeproj` is committed for convenience.

The initial target supports iOS 17+, iPhone and iPad, automatic signing, portrait and landscape orientations, and no third-party Swift dependencies.

## Failure Handling

Missing bundled resources show a native error screen rather than a blank web view. Invalid bridge messages are ignored and logged in debug builds. Picker cancellation leaves the current image untouched. Export failures return a concise message to the frontend and never discard the rendered result.

## Verification

Unit tests cover bridge decoding, filename sanitization, and bundled resource discovery. A UI test launches without network access and verifies the Jankify interface. The generated project must pass `xcodebuild` for an iOS Simulator destination, and the sync script must be idempotent.
