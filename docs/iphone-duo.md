# iPhone Duo

Notes on how the iOS app lays out on iPhone Duo (iOS 27.1 and later). Checked
2026-11-14 with Xcode 27.2 and the iOS 27.2 iPhone Duo simulator.

## Screens

| State | Viewport (pt) | Layout |
|---|---|---|
| Folded, outer screen | 466×678 | Single column (`max-width: 800px`): canvas, then controls. Unchanged. |
| Inner screen, flat open | 951×669 landscape | 320 pt controls column beside the canvas. Unchanged. |
| Inner screen, book pose | 951×669, fold at x 455.5–495.5 | Controls on the left page, canvas on the right page, nothing in the fold. |
| Inner screen, laptop pose | 669×951 portrait, fold at y 455.5–495.5 | Single column, which scrolls across the fold. Unchanged. |

In the unchanged flat layout the canvas spans x 320–951, so in book pose a
loaded image (and the Upload/Change button and the animation dialog's buttons)
would sit on the fold. Equal halves fix that: the left page holds the brand,
Edit/Create, Mode, the sidebar and the status line; the right page holds the
action buttons and the canvas, which runs the full page height.

## How it works

- `Jankify/DuoBridge.swift` and `Jankify/duo-fold.js` are byte-for-byte copies of
  the shared bridge in `lukeslp/snippets` (`mobile-capacitor/duo-bridge`,
  f280ec2). Change the snippets copy first, then copy both files here.
- `JankifyWebView` creates the bridge before the web view, attaches it, and
  refreshes it on layout (`LayoutReportingWebView`), in `updateUIView`, and after
  each navigation. The shim reaches both Edit and Create.
- The page gets `data-duo-pose="book"` and `--duo-fold-*` on `<html>` only while a
  vertical fold crosses it. `index.html` scopes every book-pose rule to that
  attribute and to `min-width: 801px`, so the web, Android, other iPhones and
  iPads never match.
- The header's two groups (`.header-start`, `.header-end`) are `display: contents`
  everywhere else, so they don't change the flat layout.
- The scroll view keeps its automatic insets. That only affects the bottom edge,
  so the fold's x position in web view points matches CSS px.

## Checks

- Real simulator: Debug build with Xcode 27.2 on an iPhone Duo (iOS 27.2) sim,
  folded. The app launches through the SwiftUI `App` life cycle (scene-based,
  so TN3187's UIScene requirement is met without a manifest). The bridge logs
  `{"hinge":true,"status":"closed","angle":0}`. The outer screen matches `main`
  pixel for pixel.
- Inner screen, simulated: Playwright WebKit at 951×669 and 3x with the iOS
  native bridge stubbed. The fold reaches the page through the same `duo-fold.js`
  (`DuoFold._native`). Flat open matches `main` except the random seed in the
  status line. In book pose, no button, link, input, label or canvas overlaps
  x 455.5–495.5 (checked with and without a photo, and with the animation
  warning open).
- `xcodebuild test` (iPhone 17 Pro, iOS 27.2), `node --test JankifyTests/*.test.js`,
  and Android `:app:testDebugUnitTest` pass.

## Limits

- The simulator can't fold from the command line, so book pose has not been
  seen on the simulator or a device. To check: open the sim in Device Hub,
  choose Partially Open, rotate to landscape, and confirm controls left, canvas
  right.
- Create (the SpaceJank snapshot under `Jankify/Resources/Web/create/`) has its
  own layout and still puts its seed field, a mode tab and the canvas on the fold
  in book pose. It is unchanged here.
- Laptop pose keeps the scrolling single column.

## Rollback

Revert the commit that added this file. The bridge is additive, so removing it
returns the shell to its previous behavior.
