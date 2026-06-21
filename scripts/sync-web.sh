#!/bin/sh
set -eu

repo_root=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
web_dir="$repo_root/Jankify/Resources/Web"
source_html="$repo_root/index.html"
output_html="$web_dir/index.html"
temporary_html="$output_html.tmp"

mkdir -p "$web_dir"
cp "$source_html" "$temporary_html"

perl -0pi -e '
  s{<link[^>]+(?:cdnjs\.cloudflare\.com|fonts\.googleapis\.com|fonts\.gstatic\.com)[^>]*>\s*}{}g;
  s{<script\s+data-goatcounter=.*?</script>\s*}{}gs;
  s{</head>}{<link rel="stylesheet" href="offline.css">\n</head>};
  s{</body>}{<script src="ios-bridge.js"></script>\n</body>};
' "$temporary_html"

mv "$temporary_html" "$output_html"
