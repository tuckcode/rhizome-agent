#!/usr/bin/env bash
# Assemble the GitHub Pages site into $1 (default: _site).
# Root = landing page from website/. /docs = Starlight from site/.
# Assets are copied from where they already live, so the repo holds one copy.
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
out="${1:-_site}"
mkdir -p "$out/assets"
cp "$root/website/index.html" "$out/index.html"
cp "$root/docs/assets/rhizome-hero-animated.webp" "$out/assets/hero.webp"
cp "$root/docs/assets/rhizome-agent-demo.mp4" "$out/assets/demo.mp4"
cp "$root/src/assets/brand/rhizome-organic-hero.png" "$out/assets/hero.png"
cp "$root/src/assets/brand/rhizome-organic-hero.png" "$out/assets/og.png"
cp "$root/src-tauri/icons/128x128.png" "$out/assets/icon.png"
touch "$out/.nojekyll"

# Starlight (Astro) → /docs. astro.config.mjs sets base to /rhizome-agent/docs
# so asset and page URLs match GitHub Pages at
# https://tuckcode.github.io/rhizome-agent/docs/.
(
  cd "$root/site"
  npm ci
  npm run build
)
rm -rf "$out/docs"
mkdir -p "$out/docs"
cp -a "$root/site/dist/." "$out/docs/"

node "$root/website/check-pages-artifact.mjs" "$out"
