#!/bin/sh
#
# File Purpose: Import a reviewed SpaceJank runtime snapshot into Jankify.
# Primary Functions: Copy an explicit file allowlist, remove hosted analytics, and adapt local navigation.
# Inputs/Outputs: Reads a PixelGen checkout; replaces Jankify/Resources/Web/create.
#
set -eu

repo_root=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
source_repo=${SPACEJANK_SOURCE:-}
source_revision=${SPACEJANK_REVISION:-}
destination="$repo_root/Jankify/Resources/Web/create"
template="$repo_root/scripts/assets/spacejank-native-shell.js"

if [ -z "$source_repo" ] || [ -z "$source_revision" ]; then
  echo "Set SPACEJANK_SOURCE to an upstream checkout and SPACEJANK_REVISION to its reviewed commit." >&2
  echo "Normal builds need only scripts/sync-web.sh and the tracked Create snapshot." >&2
  exit 1
fi
revision=$(git -C "$source_repo" rev-parse --verify "$source_revision^{commit}")
if [ -n "$(git -C "$source_repo" status --porcelain)" ]; then
  echo "Upstream checkout has uncommitted files; commit or preserve them before importing." >&2
  exit 1
fi
if [ "$destination" != "$repo_root/Jankify/Resources/Web/create" ]; then
  echo "Refusing to replace an unexpected destination." >&2
  exit 1
fi

temporary_root=$(mktemp -d "${TMPDIR:-/tmp}/jankify-spacejank.XXXXXX")
trap 'rm -rf "$temporary_root"' EXIT HUP INT TERM
snapshot="$temporary_root/create"
upstream="$temporary_root/upstream"
mkdir -p "$snapshot/app/js/modes" "$snapshot/app/shaders" "$upstream"
git -C "$source_repo" archive --output="$temporary_root/upstream.tar" "$revision" app LICENSE
tar -xf "$temporary_root/upstream.tar" -C "$upstream"
source_repo="$upstream"

cp "$source_repo/app/index.html" "$snapshot/app/index.html"
cp "$source_repo/app/styles.css" "$snapshot/app/styles.css"
for file in app fx-core history ideas names rng solarwar-vignette warship-engine webgl; do
  cp "$source_repo/app/js/$file.js" "$snapshot/app/js/$file.js"
done
cp "$repo_root/scripts/assets/spacejank-recipes.mjs" "$snapshot/app/js/native-shell.mjs"
for mode in backgrounds effects explosions planets ships sprites starscapes; do
  cp "$source_repo/app/js/modes/$mode.js" "$snapshot/app/js/modes/$mode.js"
done
cp "$source_repo/app/shaders/common.glsl.js" "$snapshot/app/shaders/common.glsl.js"
cp "$repo_root/Jankify/Assets.xcassets/AppIcon.appiconset/icon_1024x1024.png" "$snapshot/icon.png"
cp "$source_repo/LICENSE" "$snapshot/LICENSE.txt"
cp "$template" "$snapshot/native-shell.js"
cp "$repo_root/scripts/assets/spacejank-backgrounds.js" "$snapshot/app/js/modes/starscapes.js"

perl -0pi -e '
  s{\s*<script\s+data-goatcounter=.*?</script>}{}gs;
  s{href="https://jankify\.app/"}{href="../../index.html"}g;
  s{ · ports are browser-native approximations of the Godot/p5 tools}{}g;
  s{painted backgrounds}{night-sky backgrounds}g;
  s{^.*<meta (?:property="og:image[^"]*"|name="twitter:image").*\n}{}gm;
  s{summary_large_image}{summary}g;
  s{^.*<!-- \?v= busts stale caches.*\n}{}gm;
  s{(<script type="module" src="js/app\.js(?:\?[^"]*)?"></script>)}{<script src="../native-shell.js"></script>\n  $1};
' "$snapshot/app/index.html"

short_revision=$(printf '%.12s' "$revision")
printf '{\n  "repository": "https://github.com/lukeslp/PixelGen",\n  "revision": "%s",\n  "shortRevision": "%s",\n  "adaptations": ["Native export bridge and local Edit link", "Backgrounds uses Luke Steuber’s seeded canvas renderer; upstream Starscapes and p5.js are excluded"]\n}\n' \
  "$revision" "$short_revision" > "$snapshot/SOURCE.json"

rm -rf "$destination"
mv "$snapshot" "$destination"
echo "Imported SpaceJank $short_revision into $destination"
