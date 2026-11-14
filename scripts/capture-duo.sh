#!/bin/bash
# Capture Jankify's App Store screenshots on an iPhone Duo simulator.
#
#   scripts/capture-duo.sh <udid> <outer|inner> <outdir> [path/to/Jankify.app]
#
#   outer  folded cover screen, --display=1, must be 1398x2034
#   inner  open main screen, --display=LCD-1, must be 2853x2007 (landscape: flat
#          or book) or 2007x2853 (portrait: laptop). Unfold the simulator in
#          Device Hub first; a folded inner screen is black and is refused.
#
# Needs a Debug build of Jankify: the screens come from launch arguments that
# only Debug compiles (CaptureFixture in Jankify/JankifyWebView.swift), so no
# taps are needed. Three screens:
#   01-edit     Edit with the bundled Create icon (Web/create/icon.png) as the
#               sample image, Polygon mode applied
#   02-create   Create's Sprites generator at a fixed seed, with Export PNG,
#               Copy link, Vary and New piece
#   03-palette  the sample in Pixel mode cut to an 8-color palette, the
#               controls scrolled to Palette size
#
# A capture is refused if it is the wrong size, black or nearly one flat color,
# or the same as the screen before it. Accepted captures are flattened onto
# white so they have no alpha channel.
#
# It touches only the simulator you name: installs the app when a path is given,
# sets dark appearance and a 9:41 status bar (APPEARANCE=keep and
# STATUS_BAR=keep leave them alone), and relaunches the app for each screen.
# After each launch it waits WAIT seconds (default 6), then screenshots every
# couple of seconds until two frames in a row match, for up to TIMEOUT seconds
# (default 60). A launch can take more than 10 seconds to paint.
set -euo pipefail

usage() { echo "usage: $0 <udid> <outer|inner> <outdir> [path/to/Jankify.app]" >&2; exit 2; }
[ $# -ge 3 ] && [ $# -le 4 ] || usage
UDID="$1"; SURFACE="$2"; OUTDIR="$3"; APP="${4:-}"
BUNDLE=com.lukesteuber.jankify
WAIT="${WAIT:-6}"
TIMEOUT="${TIMEOUT:-60}"

command -v magick >/dev/null || { echo "ImageMagick (magick) is required." >&2; exit 1; }

case "$SURFACE" in
  outer) DISPLAY_ID=1; SIZES="1398x2034" ;;
  inner) DISPLAY_ID=LCD-1; SIZES="2853x2007 2007x2853" ;;
  *) usage ;;
esac

xcrun simctl list devices | grep -F "($UDID) (Booted)" >/dev/null \
  || { echo "Simulator $UDID is not booted." >&2; exit 1; }

if [ -n "$APP" ]; then
  [ -d "$APP" ] || { echo "No app at $APP" >&2; exit 1; }
  GOT="$(/usr/libexec/PlistBuddy -c 'Print CFBundleIdentifier' "$APP/Info.plist")"
  [ "$GOT" = "$BUNDLE" ] || { echo "$APP is $GOT, not $BUNDLE" >&2; exit 1; }
  xcrun simctl install "$UDID" "$APP"
fi
xcrun simctl get_app_container "$UDID" "$BUNDLE" >/dev/null 2>&1 \
  || { echo "$BUNDLE is not installed on $UDID; pass the .app path." >&2; exit 1; }

[ "${APPEARANCE:-dark}" = keep ] || xcrun simctl ui "$UDID" appearance "${APPEARANCE:-dark}"
[ "${STATUS_BAR:-}" = keep ] || xcrun simctl status_bar "$UDID" override --time 9:41 \
  --dataNetwork wifi --wifiMode active --wifiBars 3 --cellularMode active --cellularBars 4 \
  --batteryState charged --batteryLevel 100

mkdir -p "$OUTDIR"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

SAMPLE=(-JankifyCaptureSample create/icon.png)
screen_args() {
  case "$1" in
    01-edit)    ARGS=("${SAMPLE[@]}" -JankifyCaptureControls "mode=polygon") ;;
    02-create)  ARGS=(-JankifyCaptureRoute "create/app/index.html#/sprites?seed=2468") ;;
    03-palette) ARGS=("${SAMPLE[@]}" -JankifyCaptureControls "mode=pixel;pixel-grid=40;pixel-quantize=8;pixel-format=svg"
                      -JankifyCaptureScroll 'label[for="pixel-quantize"]') ;;
  esac
}

relaunch() {
  xcrun simctl terminate "$UDID" "$BUNDLE" >/dev/null 2>&1 || true
  xcrun simctl launch "$UDID" "$BUNDLE" "$@" >/dev/null
}

shoot() {
  xcrun simctl io "$UDID" screenshot --display="$DISPLAY_ID" "$1" >/dev/null 2>&1 \
    || { echo "Screenshot of display $DISPLAY_ID failed." >&2; exit 1; }
}
# Mean gray level, ignoring alpha: the dark UI is about 0.1, a black screen with
# only the status bar about 0.002.
mean_of() { magick "$1" -alpha off -colorspace Gray -format '%[fx:mean]' info:; }
is_dark() { awk -v m="$(mean_of "$1")" 'BEGIN { exit !(m < 0.03) }'; }
# Pixels that differ, compared at quarter size so it stays quick.
changed() {
  magick compare -metric AE -fuzz 3% \
    <(magick "$1" -alpha off -resize 25% png:-) <(magick "$2" -alpha off -resize 25% png:-) null: 2>&1 \
    | awk '{ print int($1) } END { if (NR == 0) print 999999 }' || true
}
# Screenshot until two frames in a row match and the screen is not black.
settle() {
  local out="$1" last="$WORK/last.png" try="$WORK/try.png" deadline=$((SECONDS + TIMEOUT))
  rm -f "$last"
  sleep "$WAIT"
  while :; do
    shoot "$try"
    if ! is_dark "$try" && [ -f "$last" ] && [ "$(changed "$last" "$try")" -lt 200 ]; then
      cp "$try" "$out"; return 0
    fi
    cp "$try" "$last"
    if [ "$SECONDS" -ge "$deadline" ]; then
      cp "$try" "$out"; echo "  (did not settle within ${TIMEOUT}s; checking the last frame)"; return 0
    fi
    sleep 2
  done
}

echo "Warm-up launch (the first launch after an install paints slowly)"
relaunch
settle "$WORK/warmup.png"

PREV=""
for NAME in 01-edit 02-create 03-palette; do
  screen_args "$NAME"
  relaunch "${ARGS[@]}"
  RAW="$WORK/$NAME.png"
  settle "$RAW"

  SIZE="$(magick identify -format '%wx%h' "$RAW")"
  case " $SIZES " in
    *" $SIZE "*) ;;
    *) echo "$NAME: $SIZE is not $SIZES for the $SURFACE screen; refusing." >&2; exit 1 ;;
  esac
  SD="$(magick "$RAW" -alpha off -colorspace Gray -format '%[fx:standard_deviation]' info:)"
  if is_dark "$RAW" || awk -v s="$SD" 'BEGIN { exit !(s < 0.02) }'; then
    echo "$NAME: capture is black or one flat color (mean $(mean_of "$RAW"), sd $SD); refusing." >&2; exit 1
  fi
  if [ -n "$PREV" ] && [ "$(changed "$PREV" "$RAW")" -lt 2000 ]; then
    echo "$NAME: same as the screen before it; refusing." >&2; exit 1
  fi

  OUT="$OUTDIR/$NAME.png"
  magick "$RAW" -background white -alpha remove -alpha off "$OUT"
  CHANNELS="$(magick identify -format '%[channels]' "$OUT")"
  case "$CHANNELS" in *a*) echo "$NAME: alpha survived flattening ($CHANNELS)." >&2; exit 1 ;; esac
  echo "$OUT  $SIZE  $CHANNELS"
  PREV="$RAW"
done
xcrun simctl terminate "$UDID" "$BUNDLE" >/dev/null 2>&1 || true
echo "Done. Look at each file before using it: right screen, nothing cut off."
