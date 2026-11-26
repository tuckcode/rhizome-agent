#!/usr/bin/env bash
# Install Rhizome Agent: clone the repo if needed, then install its packages.
# Chat runs on Rhizome's own engine. Nothing else is downloaded.
set -euo pipefail

if [[ ! -f package.json ]] || ! grep -q '"name": "rhizome-agent"' package.json; then
  git clone https://github.com/tuckcode/rhizome-agent.git
  cd rhizome-agent
fi

if ! command -v pnpm >/dev/null 2>&1; then
  echo "pnpm is not on PATH. Install Node.js and pnpm, then run ./install.sh again."
  exit 1
fi

pnpm install
echo "Next: run pnpm tauri dev"
