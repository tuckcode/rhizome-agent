#!/bin/bash
set -e

if ! command -v pnpm >/dev/null 2>&1 || ! command -v node >/dev/null 2>&1; then
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  if [ -s "$NVM_DIR/nvm.sh" ]; then
    # shellcheck disable=SC1090
    . "$NVM_DIR/nvm.sh" --no-use
    nvm use --silent node >/dev/null 2>&1 || true
  fi
fi

if ! command -v pnpm >/dev/null 2>&1 || ! command -v node >/dev/null 2>&1; then
  echo "❌ node and pnpm must be available to install Husky hooks"
  exit 1
fi

echo "Installing Husky hooks from .husky/ ..."
pnpm exec husky
echo "✅ Husky hooks installed"
echo ""
echo "Source of truth:"
echo "  - .husky/pre-commit"
echo "  - .husky/pre-push"
echo ""
echo "Never use --no-verify in this repo."
