# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Jankify is a single-file browser tool that "screws up your photos, without AI." All logic, markup, and styling live in `index.html` (~2160 lines, no build step, no runtime network). `og.html` + `og.png` are the social card. Repo is published at `github.com/lukeslp/jankify` and served via Caddy at `https://dr.eamer.dev/jankify/`.

## How it runs

- **Local dev:** open `index.html` directly in any modern browser. No bundler, no server, no dependencies installed. Font Awesome and IBM Plex are loaded from CDNs.
- **Production:** Caddy block in `/etc/caddy/Caddyfile` uses `handle_path /jankify/*` to serve the directory statically (gzip + SPA fallback to `/index.html`). Legacy `/artboard` redirects also live there. No `sm` entry — static only.
- **Deploy:** edit, commit, push. Caddy serves the file directly from this directory; no copy step.

## Architecture (single-file pipeline)

Five rendering modes share one pipeline, switched by `state.mode` in `index.html:757`:

| Mode | Pipeline fn | Exports |
|------|-------------|---------|
| `polygon` | `pipelinePolygon` (1421) | PNG, SVG |
| `voronoi` | `pipelineVoronoi` (1447) | PNG, SVG |
| `emoji` | `pipelineEmoji` (1480) | PNG, SVG |
| `ascii` | `pipelineAscii` (1540) | PNG, TXT, clipboard |
| `pixel` | `pipelinePixel` (1577) | PNG, plus CSS box-shadow / SVG / HTML table / Unicode blocks / JSON / plain text (`formatPixelsAs*`, 1794+) |

`runPipeline` (1394) is the orchestrator. The script is a single IIFE-style block starting at `index.html:751`; functions are grouped by labeled banner comments (`PRNG`, `Color science`, `Geometry`, `Color quantization`, `Emoji palette`, `Renderers`, `Pipeline`, `UI helpers`, `Vector exporters`, `Pixel format generators`, `Event wiring`). The tail of the file (2156+) is the `EMOJI_SOURCE` string — a ~3000-glyph comma-separated list used to build the emoji palette via `buildEmojiPalette` (1206). Keep that line intact; it is data, not formatting cruft.

Shared primitives worth knowing before editing:
- **`state`** (757): central mutable bag; every render mode caches its own grid here so re-renders can skip recompute.
- **`sobel` → `generatePoints` → `delaunay` → `voronoiCells`** (913–1050): geometry chain used by polygon + voronoi. Voronoi is the dual graph — do not recompute Delaunay separately.
- **`rgbToLab` / `deltaE94`** (816, 820): used by emoji matching with rejection tolerance. Emoji probing renders each glyph to a hidden canvas to learn its average LAB color.
- **`avgRgbRect` / `avgBrightRect` / `avgRgbaRect`** (837+): all area sampling goes through these.
- **`medianCutPalette`** (1160): optional quantization for pixel mode.
- **`scheduleRun` / `rerenderOnly`** (2136, 2140): debounced full pipeline vs cheap re-render. Sliders that change geometry call `scheduleRun`; cosmetic toggles (stroke opacity, stroke color) call `rerenderOnly`.

## Editing conventions in this file

- No build, no minifier, no module system. Add new code inside the existing `<script>` block in the appropriate banner section. Keep the banner-comment layout — it is the only navigation aid in a 2000-line file.
- New render modes follow the existing shape: cache results on `state`, add a `pipeline<Mode>` function, a `render<Mode>` function, a vector/text exporter if applicable, wire into `runPipeline`'s switch (1394) and `updateModeVisibility` (1684), and add the matching sidebar controls + event bindings near the existing `bindSlider` calls (2031+).
- Sidebar IDs are referenced by `$(id)` throughout. If you add a control, follow the existing `id="<mode>-<param>"` naming and add a matching `<mode>-<param>-value` span for live readout.
- Pixel-mode exporters live in their own band (1785–~1980) and share `state.pixelGrid` (a flat array of `{col, row, rgb, alpha}` cells). Adding a new export format = one `formatPixelsAs<Name>` function + a `<option>` in `#pixel-format` + a branch in `getPixelOutput`.

## Repo hygiene

- Single git repo (`lukeslp/jankify`) — this directory's `.git` is independent of the kernel monorepo at `/home/coolhand`. Root `git status` at `~` will not show changes here.
- `.gitignore` excludes `.claude/`, `.DS_Store`, `*.swp`, `*.bak`. Do not commit `.claude/settings.local.json`.
- Author: Luke Steuber. Never credit Claude / AI in commits or in user-facing strings inside `index.html` (the tagline is literally "Screw up your photos, without AI." — that is the brand; do not soften it).
