#!/bin/sh
#
# File Purpose: Generate the synchronized offline iOS and Android web bundles.
# Primary Functions: Strip hosted assets/analytics and inject each platform bridge.
# Inputs/Outputs: Reads canonical index.html; writes platform asset index.html files.
#
set -eu

repo_root=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
source_html="$repo_root/index.html"

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
  ' "$temporary_html"
  if [ "$strip_app_store_link" = "true" ]; then
    perl -0pi -e 's{\n  <a class="btn" id="store-link" href="https://apps\.apple\.com/app/id6782693852"[^>]*>.*?</a>\n}{}s' "$temporary_html"
  fi
  mv "$temporary_html" "$output_html"
}

sync_bundle "$repo_root/Jankify/Resources/Web" "ios-bridge.js" "true"

android_web_dir="$repo_root/android/app/src/main/assets"
if [ -d "$repo_root/android" ]; then
  cp "$repo_root/Jankify/Resources/Web/offline.css" "$android_web_dir/offline.css"
  sync_bundle "$android_web_dir" "android-bridge.js" "false"
fi
