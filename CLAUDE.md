# CLAUDE.md

Contributor architecture and source-maintenance notes.

## What this is

Jankify is a browser media-transform tool with offline iOS and Android wrappers. Web logic, markup, and styling live in `index.html`; `og.html` + `og.png` are the social card. Both native apps bundle synchronized offline copies of the same editor in a WebView.

## How it runs

- **Local development:** serve the repository root over HTTP as described in README.md. No JavaScript build step is needed. Browser fonts and icons are hosted resources; native copies use local styles.
- **Browser sources:** `index.html` owns Edit. `Jankify/Resources/Web/create/` owns the Create snapshot; `scripts/assets/spacejank-backgrounds.js` owns its canvas Backgrounds adaptation and `scripts/assets/spacejank-recipes.mjs` owns recipe-link routing. Root `create/` is generated. Do not edit generated copies directly.
- **Website:** `jankify.app` is the public site. Committing source does not deploy it.
- **Native sync:** run `scripts/sync-web.sh` after web changes. It updates both `Jankify/Resources/Web/` and `android/app/src/main/assets/`; regenerate the Xcode project with `xcodegen generate` when project settings change.
- **Native tests:** run the iOS `xcodebuild test` gate, `node --test JankifyTests/ios-bridge.test.js JankifyTests/android-bridge.test.js JankifyTests/video-animation.test.js`, and Android's `:app:testDebugUnitTest` task.

## Architecture (single-file pipeline)

Eight render modes share one pipeline, switched by `state.mode`. Default mode is `pixel`.

Photos are still-image inputs. Animated GIFs and short MP4, MOV, M4V, or WebM clips also enter the shared animation pipeline. Pixel, Lite Brite, ASCII, Emoji, Hatch, and Rough can export looping GIFs, PNG sprite sheets, or processed video; Polygon and Voronoi remain still-only. Animation work is bounded to 10 seconds, 30 fps, and 300 frames, with progress and safer-motion controls.

| Mode | Pipeline fn | Exports |
|------|-------------|---------|
| `pixel` | `pipelinePixel` | PNG, plus CSS box-shadow / SVG / HTML table / Unicode blocks / JSON / plain text |
| `brite` | `pipelineBrite` | PNG only |
| `ascii` | `pipelineAscii` | PNG, TXT, clipboard |
| `emoji` | `pipelineEmoji` | PNG, SVG |
| `hatch` | `pipelineHatch` | PNG, SVG |
| `rough` | `pipelineRough` | PNG, SVG |
| `polygon` | `pipelinePolygon` | PNG, SVG |
| `voronoi` | `pipelineVoronoi` | PNG, SVG |

`runPipeline` is the orchestrator. The script is a single IIFE-style block at the bottom of `index.html`; functions are grouped by labeled banner comments (`PRNG`, `Color space`, `Lite Brite palette`, `Area samplers`, `Sobel + Delaunay`, `Voronoi`, `Median-cut quantization`, `Emoji palette`, `Renderers`, `Image loading`, `Pipeline`, `Helpers`, `Output format generators`, `Pixel format generators`, `Wiring`). Banner blocks are the only file-level navigation — keep them. The tail of the file is the `EMOJI_SOURCE` string, a ~3000-glyph comma-separated list consumed by `buildEmojiPalette`. Keep that line intact; it is data, not formatting cruft.

Shared primitives worth knowing before editing:

- **`state`** — central mutable bag; every render mode caches its own grid here so re-renders can skip recompute.
- **`sobel` → `generatePoints` → `delaunay` → `voronoiCells`** — geometry chain used by polygon + voronoi. Voronoi is the dual graph; do not recompute Delaunay separately.
- **`rgbToLab` / `deltaE94`** — used by emoji nearest-match AND Lite Brite palette match (`nearestBritePeg`). Emoji probing renders each glyph to a hidden canvas to learn its LAB color.
- **`avgRgbRect` / `avgBrightRect` / `avgRgbaRect`** — all area sampling goes through these.
- **`medianCutPalette`** — optional quantization for pixel mode.
- **`computeHatch` / `renderHatch`** — tone-driven pen strokes and source-color ink.
- **`renderRough` / `svgRough`** — rough.js-backed raster and SVG sketch output.
- **`scheduleRun` / `rerenderOnly`** — debounced full pipeline vs cheap re-render. Sliders that change geometry call `scheduleRun`; cosmetic toggles (stroke opacity, stroke color) call `rerenderOnly`. Brite mode uses a longer 300ms debounce and honors `prefers-reduced-motion`.

## Lite Brite mode specifics

- **Palette:** fixed 8-color Hasbro authentic set (`LITE_BRITE_PALETTE`) with precomputed LAB. Not user-adjustable by design.
- **Geometry:** offset-square layout (alternate rows shifted ½ pitch horizontally — matches the real toy, not pure hex close-pack). Pegs are drawn as circles via `ctx.arc` in the cached sprite.
- **Renderer:** one pre-rendered peg sprite per palette color cached in `briteSpriteCache` and blitted with `drawImage`. One radial vignette behind the grid acts as "the bulb." No `globalCompositeOperation='lighter'` (additive blending saturates and trips photosensitivity thresholds).
- **Safety:** cells below `BRITE_LUMA_FLOOR` (or with alpha < 128) render as empty holes, not pegs. There is no black peg in the authentic palette.
- **Classic preset:** `#brite-classic` checkbox locks the output canvas to authentic Hasbro 9×12 inch board proportions — true 4:3 (960×720 landscape, 720×960 portrait), regardless of input image aspect or any other setting. Peg size 14px, pitch 22px, so the offset-square layout fits ~43×37 (or 37×43) pegs naturally inside the locked frame. Input image is center-cropped to match the output aspect. Peg-size and peg-spacing sliders are disabled while classic is active.

## Editing conventions in this file

- No build, no minifier, no module system. Add new code inside the existing `<script>` block in the appropriate banner section.
- New render modes follow the existing shape: cache results on `state`, add a `pipeline<Mode>` function, a `render<Mode>` function, an optional vector/text exporter, wire into `runPipeline`, `updateModeVisibility`, `updateStatus`, and the sidebar controls.
- Sidebar IDs follow `id="<mode>-<param>"` with a matching `<mode>-<param>-value` span for live readout. The `data-modes` attribute on each `.mode-section` controls visibility; `updateModeVisibility` reads it.
- Pixel-mode exporters share `state.pixelGrid` (`{col, row, rgb, alpha}` cells). Adding a new export format = one `formatPixelsAs<Name>` function + a `<option>` in `#pixel-format` + a branch in `getPixelOutput`.
- Default to no comments. Section banners stay (they are file navigation); inline explanatory `//` comments do not.

## Native wrappers

- `project.yml` is canonical; regenerate and commit `Jankify.xcodeproj` after changes.
- `JankifyWebView` loads only the bundled `Web/` directory. External links open in Safari.
- `BridgeController` validates picker, share, and clipboard messages. `ios-bridge.js` maps web controls to those native actions.
- Android's `MainActivity` hosts the generated asset bundle, applies the same image/video import and export policy, and routes shares through `android-bridge.js`.
- Keep browser-specific behavior in `index.html` and app-only behavior in `Jankify/Resources/Web/ios-bridge.js`.
- When a web mode adds an export type, update both native bridges and extend their JavaScript and native policy tests.

## Repository hygiene

- Inspect changes and stage only intended files. Preserve unrelated work.
- Keep signing credentials, local settings, generated build output and private input media out of commits.
- Preserve upstream copyrights and `THIRD_PARTY_NOTICES.md` when moving or copying bundled code.
- Credit Luke Steuber for Jankify's original work.
