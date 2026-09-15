#!/bin/sh
#
# File Purpose: Build and stage signed, versioned Android release artifacts.
# Primary Functions: Validate signing inputs, build APK/AAB, verify signatures, and write SHA-256 checksums.
# Inputs/Outputs: Reads signing environment variables; writes dist/android/vVERSION artifacts.
#
set -eu

repo_root=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
android_dir="$repo_root/android"

for variable in JANKIFY_STORE_FILE JANKIFY_STORE_PASSWORD JANKIFY_KEY_ALIAS JANKIFY_KEY_PASSWORD; do
  value=$(printenv "$variable" || true)
  if [ -z "$value" ]; then
    echo "Missing required signing environment variable: $variable" >&2
    exit 1
  fi
done
test -f "$JANKIFY_STORE_FILE" || {
  echo "Signing store does not exist: $JANKIFY_STORE_FILE" >&2
  exit 1
}

"$repo_root/scripts/sync-web.sh"

version=$(
  cd "$android_dir"
  ./gradlew --quiet :app:printVersion | awk 'NF { value=$0 } END { print value }'
)
case "$version" in
  *[!0-9A-Za-z._-]*|"")
    echo "Invalid Android version: $version" >&2
    exit 1
    ;;
esac
stage_dir="$repo_root/dist/android/v$version"

(
  cd "$android_dir"
  ./gradlew clean :app:testDebugUnitTest :app:assembleRelease :app:bundleRelease
)

apk="$android_dir/app/build/outputs/apk/release/app-release.apk"
aab="$android_dir/app/build/outputs/bundle/release/app-release.aab"
test -f "$apk"
test -f "$aab"

android_sdk=${ANDROID_HOME:-${ANDROID_SDK_ROOT:-"$HOME/Library/Android/sdk"}}
build_tools="$android_sdk/build-tools/36.0.0"
"$build_tools/apksigner" verify --verbose "$apk"
aab_verification=$(mktemp)
trap 'rm -f "$aab_verification"' EXIT
set +e
jarsigner -verify -strict "$aab" >"$aab_verification" 2>&1
aab_status=$?
set -e
# Self-signed release certificates make jarsigner return 4 for certificate
# chain warnings even when every bundle entry is signed. Reject any other
# status and still require jarsigner's explicit success marker.
if [ "$aab_status" -ne 0 ] && [ "$aab_status" -ne 4 ]; then
  cat "$aab_verification" >&2
  exit "$aab_status"
fi
grep -q "^jar verified" "$aab_verification" || {
  cat "$aab_verification" >&2
  exit 1
}

mkdir -p "$stage_dir"
cp "$apk" "$stage_dir/Jankify-$version.apk"
cp "$aab" "$stage_dir/Jankify-$version.aab"
(
  cd "$stage_dir"
  shasum -a 256 "Jankify-$version.apk" "Jankify-$version.aab" > SHA256SUMS
)

echo "Staged signed Android artifacts in $stage_dir"
