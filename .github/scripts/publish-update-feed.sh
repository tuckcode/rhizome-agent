#!/usr/bin/env bash
# Publish a moving prerelease tag that always serves the newest updater JSON.
# Alpha releases are prereleases, so GitHub's /releases/latest/download does
# not serve them. This tag is also a prerelease so it does not become Latest.
set -euo pipefail

tag="${1:?tag}"
file="${2:?feed file}"
repo="${GITHUB_REPOSITORY:?}"

if [ ! -f "$file" ]; then
  echo "::error::Missing update feed file: $file"
  exit 1
fi

notes="Moving updater manifest. Installers are on the versioned release. This tag stays a prerelease so it does not replace Latest."

if gh release view "$tag" --repo "$repo" >/dev/null 2>&1; then
  gh release upload "$tag" "$file" --clobber --repo "$repo"
else
  gh release create "$tag" "$file" \
    --repo "$repo" \
    --prerelease \
    --title "$tag" \
    --notes "$notes"
fi

echo "Update feed: https://github.com/${repo}/releases/download/${tag}/$(basename "$file")"
