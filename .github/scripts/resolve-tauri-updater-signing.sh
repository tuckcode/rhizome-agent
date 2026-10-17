#!/usr/bin/env bash
# Read TAURI_SIGNING_PRIVATE_KEY and TAURI_SIGNING_PRIVATE_KEY_PASSWORD.
# A missing secret is an empty string in GitHub Actions. An empty key must
# not be exported: Tauri treats a present variable as "sign with this".
set -euo pipefail

key="${TAURI_SIGNING_PRIVATE_KEY:-}"
password="${TAURI_SIGNING_PRIVATE_KEY_PASSWORD:-}"
output="${GITHUB_OUTPUT:-}"

write_output() {
  if [ -n "$output" ]; then
    printf '%s\n' "$1" >> "$output"
  fi
}

if [ -z "$key" ]; then
  echo "::warning::TAURI_SIGNING_PRIVATE_KEY not set — building unsigned. In-app updates need a signed release."
  write_output "updater_signing=false"
  exit 0
fi

if [ -z "${RUNNER_TEMP:-}" ]; then
  echo "::error::RUNNER_TEMP is not set"
  exit 1
fi

printf '%s' "$key" > "$RUNNER_TEMP/tauri-signing-private-key"
printf '%s' "$password" > "$RUNNER_TEMP/tauri-signing-private-key-password"
chmod 600 "$RUNNER_TEMP/tauri-signing-private-key" "$RUNNER_TEMP/tauri-signing-private-key-password"
write_output "updater_signing=true"
