#!/usr/bin/env bash
# Install Rhizome Agent. Fetch Prime Agent when it is not already on PATH.
# Chat uses Prime. This downloads the Prime command-line tool Prime publishes.
set -euo pipefail

if [[ ! -f package.json ]] || ! grep -q '"name": "rhizome-agent"' package.json; then
  git clone https://github.com/tuckcode/rhizome-agent.git
  cd rhizome-agent
fi

if ! command -v prime-agent >/dev/null 2>&1; then
  echo "Fetching Prime Agent. Rhizome uses it for chat."
  curl --proto '=https' --proto-redir '=https' -fsSL https://app.primeintellect.ai/prime-agent/install.sh | sh
else
  echo "Prime Agent is already on PATH."
fi

if ! command -v pnpm >/dev/null 2>&1; then
  echo "pnpm is not on PATH. Install Node.js and pnpm, then run ./install.sh again."
  exit 1
fi

pnpm install
echo "Next: run prime-agent once and use /login. Then run: pnpm tauri dev"
