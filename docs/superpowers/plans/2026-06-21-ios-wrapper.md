# Jankify iOS Wrapper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an offline iPhone and iPad wrapper for Jankify with native image import, sharing, file export, and clipboard integration.

**Architecture:** An XcodeGen-generated SwiftUI app hosts a bundled frontend in `WKWebView`. A typed Swift message decoder and app-only JavaScript bridge connect existing browser controls to PhotosUI, UIKit sharing, and the system clipboard without changing hosted behavior.

**Tech Stack:** Swift 6, SwiftUI, WebKit, PhotosUI, UIKit, XCTest, XCUITest, XcodeGen, shell.

## Global Constraints

- Minimum deployment target is iOS 17.0 for iPhone and iPad.
- Normal app operation must require no network or server connection.
- Use no third-party Swift dependencies.
- Keep `index.html` canonical and hosted behavior unchanged.
- Treat `project.yml` as canonical and commit the generated `Jankify.xcodeproj`.
- Do not push or rewrite remote history.

---

### Task 1: Typed Bridge Contract and Project Skeleton

**Files:**
- Create: `project.yml`
- Create: `Jankify/JankifyApp.swift`
- Create: `Jankify/ContentView.swift`
- Create: `Jankify/BridgeMessage.swift`
- Create: `Jankify/Info.plist`
- Create: `JankifyTests/BridgeMessageTests.swift`

**Interfaces:**
- Produces: `BridgeMessage.decode(_:) throws -> BridgeMessage`, `ExportPayload.decodedData() throws -> Data`, and `ExportPayload.safeFilename: String`.

- [ ] **Step 1: Create the XcodeGen skeleton and a failing XCTest suite** covering valid `pickImage`, valid base64 export, unsupported actions, malformed base64, filename sanitization, and the 50 MB decoded export limit.
- [ ] **Step 2: Generate and run the focused tests** with `xcodegen generate` and `xcodebuild test -project Jankify.xcodeproj -scheme Jankify -destination 'platform=iOS Simulator,name=iPhone 17 Pro' -only-testing:JankifyTests`; expect failures because bridge types do not exist.
- [ ] **Step 3: Implement the minimal Codable-style dictionary decoder**, strict action allowlist, MIME allowlist (`image/png`, `image/svg+xml`, `text/plain`, `text/css`, `text/html`, `application/json`), base64 validation, byte limit, and filename sanitization.
- [ ] **Step 4: Re-run the focused suite** and expect all `BridgeMessageTests` to pass.
- [ ] **Step 5: Verify git state and commit specific Task 1 files** with `git commit -m "feat(ios): add app skeleton and bridge contract"`.

### Task 2: Deterministic Offline Frontend Bundle

**Files:**
- Create: `scripts/sync-web.sh`
- Create: `Jankify/Resources/Web/ios-bridge.js`
- Create: `Jankify/Resources/Web/offline.css`
- Generate: `Jankify/Resources/Web/index.html`
- Create: `Jankify/BundleContent.swift`
- Create: `JankifyTests/BundleContentTests.swift`
- Modify: `project.yml`

**Interfaces:**
- Produces: `BundleContent.indexURL(in:) throws -> URL` and an idempotent sync script that copies root `index.html`, removes remote font/icon/analytics tags, and injects local `offline.css` plus `ios-bridge.js` before `</body>`.

- [ ] **Step 1: Add failing resource tests** asserting the bundled page exists, contains `ios-bridge.js`, and contains no `https://fonts.googleapis.com`, `cdnjs.cloudflare.com`, or GoatCounter script URL.
- [ ] **Step 2: Run `JankifyTests/BundleContentTests`** and expect failure because no bundled page exists.
- [ ] **Step 3: Implement the sync script and local fallback icon CSS**, run it twice, and compare SHA-256 hashes to prove idempotence.
- [ ] **Step 4: Implement `BundleContent` and add the Web folder as a resource in `project.yml`; regenerate the project and run the resource tests** expecting pass.
- [ ] **Step 5: Verify git state and commit specific Task 2 files** with `git commit -m "feat(ios): bundle frontend for offline use"`.

### Task 3: Web View and Native Bridge

**Files:**
- Create: `Jankify/JankifyWebView.swift`
- Create: `Jankify/BridgeController.swift`
- Modify: `Jankify/ContentView.swift`
- Complete: `Jankify/Resources/Web/ios-bridge.js`
- Create: `JankifyTests/BridgeControllerTests.swift`

**Interfaces:**
- Consumes: `BridgeMessage.decode(_:)`, `ExportPayload.decodedData()`, and `BundleContent.indexURL(in:)`.
- Produces: a `UIViewRepresentable` loading local files and a `@MainActor BridgeController` that publishes picker requests and handles share/copy messages.

- [ ] **Step 1: Add failing tests** for export temporary-file creation, copied text extraction, and rejection of invalid messages.
- [ ] **Step 2: Run the focused controller tests** and expect failure because `BridgeController` does not exist.
- [ ] **Step 3: Implement `JankifyWebView` and its coordinator**, local-only navigation policy, debug inspection, script handler cleanup, picker callback injection, temporary exports, share-sheet presentation, and clipboard writes.
- [ ] **Step 4: Implement capture-phase JavaScript interception** for upload, PNG/vector download, and copy controls; retain existing browser listeners when the native handler is unavailable.
- [ ] **Step 5: Run all unit tests** and expect pass, then verify git state and commit with `git commit -m "feat(ios): connect native import and export bridge"`.

### Task 4: App Assets and End-to-End Verification

**Files:**
- Create: `Jankify/Assets.xcassets/Contents.json`
- Create: `Jankify/Assets.xcassets/AccentColor.colorset/Contents.json`
- Create: `Jankify/Assets.xcassets/AppIcon.appiconset/Contents.json`
- Create: `JankifyUITests/JankifyLaunchTests.swift`
- Modify: `.gitignore`
- Modify: `project.yml`

**Interfaces:**
- Produces: a launchable signed app target and UI smoke test identified by the accessibility label `Jankify web content`.

- [ ] **Step 1: Add a failing UI launch test** that waits for the bundled interface and verifies the mode picker and image chooser are present.
- [ ] **Step 2: Add asset catalogs, launch configuration, test target, and deterministic accessibility identifiers**, then regenerate the project.
- [ ] **Step 3: Run `xcodebuild test -project Jankify.xcodeproj -scheme Jankify -destination 'platform=iOS Simulator,name=iPhone 17 Pro'`** and expect all unit and UI tests to pass.
- [ ] **Step 4: Build a generic simulator app** with `xcodebuild build -project Jankify.xcodeproj -scheme Jankify -destination 'generic/platform=iOS Simulator'` and expect `BUILD SUCCEEDED`.
- [ ] **Step 5: Run `git diff --check`, inspect the final diff/status/log, and commit specific Task 4 files** with `git commit -m "test(ios): verify offline app launch"`.
