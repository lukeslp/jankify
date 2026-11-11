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

sync_bundle "$repo_root/Jankify/Resources/Web" "ios-bridge.js" "true"

rm -rf "$repo_root/create"
cp -R "$create_source" "$repo_root/create"

android_web_dir="$repo_root/android/app/src/main/assets"
if [ -d "$repo_root/android" ]; then
  mkdir -p "$android_web_dir"
  cp "$repo_root/Jankify/Resources/Web/offline.css" "$android_web_dir/offline.css"
  sync_bundle "$android_web_dir" "android-bridge.js" "false"
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
