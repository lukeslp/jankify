#!/bin/sh
#
# File Purpose: Generate the synchronized offline iOS and Android web bundles.
# Primary Functions: Strip hosted assets/analytics and inject each platform bridge.
# Inputs/Outputs: Reads canonical index.html; writes platform asset index.html files.
#
set -eu

repo_root=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
source_html="$repo_root/index.html"
create_source="$repo_root/Jankify/Resources/Web/create"

if [ ! -f "$create_source/app/index.html" ] || [ ! -f "$create_source/SOURCE.json" ]; then
  echo "Missing tracked Create snapshot. Restore Jankify/Resources/Web/create from Git." >&2
  exit 1
fi
cp "$repo_root/scripts/assets/spacejank-backgrounds.js" "$create_source/app/js/modes/starscapes.js"
cp "$repo_root/scripts/assets/spacejank-recipes.mjs" "$create_source/app/js/native-shell.mjs"

sync_bundle() {
  web_dir=$1
  bridge_script=$2
  strip_app_store_link=$3
  output_html="$web_dir/index.html"
  temporary_html="$output_html.tmp"

  mkdir -p "$web_dir"
  cp "$source_html" "$temporary_html"
  BRIDGE_SCRIPT=$bridge_script perl -0pi -e '
    s{<link[^>]+(?:cdnjs\.cloudflare\.com|fonts\.googleapis\.com|fonts\.gstatic\.com)[^>]*>\s*}{}g;
    s{<script\s+data-goatcounter=.*?</script>\s*}{}gs;
    s{</head>}{<link rel="stylesheet" href="offline.css">\n</head>};
    s{</body>}{<script src="$ENV{BRIDGE_SCRIPT}"></script>\n</body>};
    s{href="https://jankify\.app/create/"}{href="create/app/index.html#/effects"}g;
  ' "$temporary_html"
  if [ "$strip_app_store_link" = "true" ]; then
    perl -0pi -e 's{\n  <a class="btn" id="store-link" href="https://apps\.apple\.com/app/id6782693852"[^>]*>.*?</a>\n}{}s' "$temporary_html"
  fi
  mv "$temporary_html" "$output_html"
}

# Android-only wording. Each rule must match, so a change to the canonical page
# that would silently skip one fails the sync instead.
android_wording() {
  perl -0pi -e '
    sub swap { my ($from, $to, $min) = @_; my $n = () = s{\Q$from\E}{$to}g; die "sync-web: expected \"$from\" in the Android page\n" if $n < ($min // 1); }
    # Store builds do not use the toy maker\x27s names; the mode keeps its id.
    swap(q{<option value="brite">Lite Brite</option>}, q{<option value="brite">Peg Board</option>});
    swap(q{<h3>Lite Brite</h3>}, q{<h3>Peg Board</h3>});
    swap(q{Locks output to authentic Hasbro 12:9 aspect (4:3 landscape, 3:4 portrait).}, q{Locks output to the classic 4:3 board shape (3:4 in portrait).});
    swap(q{aria-label="Lite Brite palette colors"}, q{aria-label="Peg Board palette colors"});
    swap(q{Authentic 8-peg Hasbro set.}, q{A fixed set of eight peg colors.});
    swap(q{Pixel, Lite Brite, ASCII, Emoji, Hatch, and Rough support animation.}, q{Pixel, Peg Board, ASCII, Emoji, Hatch, and Rough support animation.});
    swap(q{Pixel<span class="dot">·</span>Lite Brite<span}, q{Pixel<span class="dot">·</span>Peg Board<span});
    swap(q{switch to Pixel, Lite Brite, ASCII, Emoji, Hatch, or Rough}, q{switch to Pixel, Peg Board, ASCII, Emoji, Hatch, or Rough});
    # The app has no drop target or keyboard paste, and media comes from the system file picker.
    swap(qq{      <p class="hint-line hint-desktop">or drop one anywhere here · paste with <kbd>⌘ V</kbd></p>\n      <p class="hint-line hint-mobile">photos, screenshots, GIFs, or videos from your camera roll</p>}, q{      <p class="hint-line">photos, screenshots, GIFs, or videos from your files</p>});
    # Nothing is uploaded or downloaded in the app: media is opened, results are shared.
    swap(q{<span id="upload-btn-label">Upload</span>}, q{<span id="upload-btn-label">Open</span>});
    swap(q{Uses the first seconds of an uploaded GIF or video.}, q{Uses the first seconds of the GIF or video.});
    swap(q{Download / Copy uses this format.}, q{File and Copy use this format.});
    swap(q{"Preparing GIF download…"}, q{"Preparing GIF…"});
    swap(q{"Download ready"}, q{"Ready to share"});
    swap(q{or a video when your browser supports recording.}, q{or a video when this device supports recording.});
    swap(q{Trim on your phone first to choose a different moment.}, q{Trim it first to choose a different moment.});
    # Bundled third-party code and its licenses, reachable from the controls.
    swap(qq{\n  </aside>}, qq{\n    <div class="control licenses-line">\n      <div class="hint"><a id="licenses-link" href="licenses.html" style="display:inline-block;padding:16px 0;color:inherit">Open-source licenses</a></div>\n    </div>\n\n  </aside>});
  ' "$1"
}

sync_bundle "$repo_root/Jankify/Resources/Web" "ios-bridge.js" "true"

rm -rf "$repo_root/create"
cp -R "$create_source" "$repo_root/create"

android_web_dir="$repo_root/android/app/src/main/assets"
if [ -d "$repo_root/android" ]; then
  mkdir -p "$android_web_dir"
  cp "$repo_root/Jankify/Resources/Web/offline.css" "$android_web_dir/offline.css"
  sync_bundle "$android_web_dir" "android-bridge.js" "false"
  android_wording "$android_web_dir/index.html"
  "$repo_root/scripts/build-android-licenses.py"
  rm -rf "$android_web_dir/create"
  cp -R "$repo_root/Jankify/Resources/Web/create" "$android_web_dir/create"
fi

for web_dir in "$repo_root/Jankify/Resources/Web" "$android_web_dir"; do
  [ -d "$web_dir" ] || continue
  cp "$repo_root/LICENSE" "$web_dir/LICENSE"
  cp "$repo_root/THIRD_PARTY_NOTICES.md" "$web_dir/THIRD_PARTY_NOTICES.md"
  perl -0pi -e 's{Jankify/Resources/Web/create/}{create/}g' "$web_dir/THIRD_PARTY_NOTICES.md"
  rm -rf "$web_dir/licenses"
  cp -R "$repo_root/licenses" "$web_dir/licenses"
done
