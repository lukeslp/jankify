#!/bin/sh
#
# File Purpose: Import a reviewed SpaceJank runtime snapshot into Jankify.
# Primary Functions: Copy an explicit file allowlist, remove hosted analytics, and adapt local navigation.
# Inputs/Outputs: Reads a PixelGen checkout; replaces Jankify/Resources/Web/create.
#
set -eu

repo_root=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
source_repo=${SPACEJANK_SOURCE:-"$repo_root/../PixelGen"}
destination="$repo_root/Jankify/Resources/Web/create"
template="$repo_root/scripts/assets/spacejank-native-shell.js"

if [ ! -d "$source_repo/.git" ] || [ ! -f "$source_repo/app/index.html" ]; then
  echo "SpaceJank source checkout not found: $source_repo" >&2
  exit 1
fi
if [ "$destination" != "$repo_root/Jankify/Resources/Web/create" ]; then
  echo "Refusing to replace an unexpected destination." >&2
  exit 1
fi

temporary_root=$(mktemp -d "${TMPDIR:-/tmp}/jankify-spacejank.XXXXXX")
trap 'rm -rf "$temporary_root"' EXIT HUP INT TERM
snapshot="$temporary_root/create"
mkdir -p "$snapshot/app/js/modes" "$snapshot/app/shaders" "$snapshot/Starscapes"

cp "$source_repo/app/index.html" "$snapshot/app/index.html"
cp "$source_repo/app/styles.css" "$snapshot/app/styles.css"
for file in app fx-core history ideas names rng solarwar-vignette warship-engine webgl; do
  cp "$source_repo/app/js/$file.js" "$snapshot/app/js/$file.js"
done
cp "$source_repo/app/js/native-shell.mjs" "$snapshot/app/js/native-shell.mjs"
for mode in backgrounds effects explosions planets ships sprites starscapes; do
  cp "$source_repo/app/js/modes/$mode.js" "$snapshot/app/js/modes/$mode.js"
done
cp "$source_repo/app/shaders/common.glsl.js" "$snapshot/app/shaders/common.glsl.js"
for file in FieldDrawer PaintParticle StarParticle fields index p5.min sketch willReadFrequently; do
  cp "$source_repo/Starscapes/$file.js" "$snapshot/Starscapes/$file.js"
done
cp "$source_repo/Starscapes/index.html" "$snapshot/Starscapes/index.html"
cp "$source_repo/icon.png" "$snapshot/icon.png"
cp "$source_repo/LICENSE" "$snapshot/LICENSE.txt"
cp "$template" "$snapshot/native-shell.js"

perl -0pi -e '
  s{\s*<script\s+data-goatcounter=.*?</script>}{}gs;
  s{href="https://jankify\.app/"}{href="../../index.html"}g;
  s{(<script type="module" src="js/app\.js\?v=17"></script>)}{<script src="../native-shell.js"></script>\n  $1};
' "$snapshot/app/index.html"

revision=$(git -C "$source_repo" rev-parse HEAD)
short_revision=$(git -C "$source_repo" rev-parse --short=12 HEAD)
printf '{\n  "repository": "https://github.com/lukeslp/PixelGen",\n  "revision": "%s",\n  "shortRevision": "%s"\n}\n' \
  "$revision" "$short_revision" > "$snapshot/SOURCE.json"

rm -rf "$destination"
mv "$snapshot" "$destination"
echo "Imported SpaceJank $short_revision into $destination"
