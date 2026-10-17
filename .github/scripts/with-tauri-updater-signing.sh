#!/usr/bin/env bash
# Run a Tauri build with updater signing when the resolve step stored a key.
# Otherwise force createUpdaterArtifacts off so an unsigned build still passes.
set -euo pipefail

if [ "$#" -eq 0 ]; then
  echo "::error::with-tauri-updater-signing.sh needs a command" >&2
  exit 1
fi

key_file="${RUNNER_TEMP:-}/tauri-signing-private-key"
pass_file="${RUNNER_TEMP:-}/tauri-signing-private-key-password"
extra=()

if [ -n "${RUNNER_TEMP:-}" ] && [ -s "$key_file" ]; then
  TAURI_SIGNING_PRIVATE_KEY="$(cat "$key_file")"
  export TAURI_SIGNING_PRIVATE_KEY
  if [ -s "$pass_file" ]; then
    TAURI_SIGNING_PRIVATE_KEY_PASSWORD="$(cat "$pass_file")"
    export TAURI_SIGNING_PRIVATE_KEY_PASSWORD
  else
    unset TAURI_SIGNING_PRIVATE_KEY_PASSWORD || true
  fi
else
  unset TAURI_SIGNING_PRIVATE_KEY || true
  unset TAURI_SIGNING_PRIVATE_KEY_PASSWORD || true
  echo "::warning::TAURI_SIGNING_PRIVATE_KEY not set — building unsigned (updater artifacts off for this build)."
  extra+=(--config)
  extra+=('{"bundle":{"createUpdaterArtifacts":false}}')
fi

exec "$@" ${extra[@]+"${extra[@]}"}
