# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Jankify is a single-file browser tool that "screws up your photos, without AI." All logic, markup, and styling live in `index.html` (~2390 lines, no build step, no runtime network). `og.html` + `og.png` are the social card. Repo is published at `github.com/lukeslp/jankify` and served via Caddy at `https://dr.eamer.dev/jankify/`.

## How it runs

- **Local dev:** open `index.html` directly in any modern browser, or serve the directory over HTTP if you need to load a test image via `fetch` (Chrome blocks `file://` fetch). No bundler, no dependencies installed. Font Awesome and IBM Plex are loaded from CDNs.
- **Production:** Caddy block in `/etc/caddy/Caddyfile` uses `handle_path /jankify/*` to serve the directory statically (gzip + SPA fallback to `/index.html`). Legacy `/artboard` redirects also live there. No `sm` entry — static only.
- **Deploy:** edit, commit, push. Caddy serves the file directly from this directory; no copy step.

## Architecture (single-file pipeline)

Six render modes share one pipeline, switched by `state.mode`. Default mode is `pixel`.

| Mode | Pipeline fn | Exports |
|------|-------------|---------|
| `pixel` | `pipelinePixel` | PNG, plus CSS box-shadow / SVG / HTML table / Unicode blocks / JSON / plain text |
| `brite` | `pipelineBrite` | PNG only |
| `ascii` | `pipelineAscii` | PNG, TXT, clipboard |
| `emoji` | `pipelineEmoji` | PNG, SVG |
| `polygon` | `pipelinePolygon` | PNG, SVG |
| `voronoi` | `pipelineVoronoi` | PNG, SVG |

`runPipeline` is the orchestrator. The script is a single IIFE-style block at the bottom of `index.html`; functions are grouped by labeled banner comments (`PRNG`, `Color space`, `Lite Brite palette`, `Area samplers`, `Sobel + Delaunay`, `Voronoi`, `Median-cut quantization`, `Emoji palette`, `Renderers`, `Image loading`, `Pipeline`, `Helpers`, `Output format generators`, `Pixel format generators`, `Wiring`). Banner blocks are the only file-level navigation — keep them. The tail of the file is the `EMOJI_SOURCE` string, a ~3000-glyph comma-separated list consumed by `buildEmojiPalette`. Keep that line intact; it is data, not formatting cruft.

Shared primitives worth knowing before editing:

- **`state`** — central mutable bag; every render mode caches its own grid here so re-renders can skip recompute.
- **`sobel` → `generatePoints` → `delaunay` → `voronoiCells`** — geometry chain used by polygon + voronoi. Voronoi is the dual graph; do not recompute Delaunay separately.
- **`rgbToLab` / `deltaE94`** — used by emoji nearest-match AND Lite Brite palette match (`nearestBritePeg`). Emoji probing renders each glyph to a hidden canvas to learn its LAB color.
- **`avgRgbRect` / `avgBrightRect` / `avgRgbaRect`** — all area sampling goes through these.
- **`medianCutPalette`** — optional quantization for pixel mode.
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

## Repo hygiene

- Single git repo (`lukeslp/jankify`) — this directory's `.git` is independent of the kernel monorepo at `/home/coolhand`. Root `git status` at `~` will not show changes here.
- `.gitignore` excludes `.claude/`, `.DS_Store`, `*.swp`, `*.bak`, `.playwright-mcp/`, and the screenshot Playwright drops in the repo root. Do not commit `.claude/settings.local.json`.
- Author: Luke Steuber. Never credit Claude / AI in commits or in user-facing strings inside `index.html` (the tagline is literally "Screw up your photos, without AI." — that is the brand; do not soften it).
