#!/bin/sh
# Sourced by .husky/pre-push. A stub test sources this file and does not run
# the rest of the hook.
#
# A missing browser binary does not fail loudly — every spec dies in about a
# millisecond inside browserType.launch, so the lane reports twenty-six
# failures that look like the change under test broke everything.
#
# Playwright pins a browser build per version, so a version bump orphans the
# cached binary. That happened on 2026-08-22 between two pushes an hour
# apart, with no change to any test.
#
# C81: `npx playwright install` on Windows hung 20+ minutes with its output
# discarded and no timeout (Playwright 1.58.2, browser build chromium-1208).
# Install output stays visible. Both the dry-run and the install have a
# timeout (default 600s, override with PLAYWRIGHT_INSTALL_TIMEOUT_SECS).
# A timeout is a failed push. A dry-run that exits non-zero for any other
# reason still returns 0, so a dry-run quirk does not start failing pushes
# when the browser is already installed. Install runs only after a dry-run
# that exited 0.

# Cache directory Playwright uses for downloaded browser builds.
playwright_browser_cache_dir() {
  local uname_s
  uname_s=$(uname -s 2>/dev/null || printf '%s\n' "")
  case "$uname_s" in
    Darwin)
      printf '%s\n' "$HOME/Library/Caches/ms-playwright"
      return 0
      ;;
    MINGW*|MSYS*|CYGWIN*)
      printf '%s\n' "${LOCALAPPDATA:-$USERPROFILE/AppData/Local}/ms-playwright"
      return 0
      ;;
  esac
  if [ "${OS:-}" = "Windows_NT" ]; then
    printf '%s\n' "${LOCALAPPDATA:-$USERPROFILE/AppData/Local}/ms-playwright"
    return 0
  fi
  printf '%s\n' "${XDG_CACHE_HOME:-$HOME/.cache}/ms-playwright"
}

# Kill a process and the children it spawned. macOS has no GNU timeout and
# no setsid; a shell script that sleeps leaves `sleep` as a child.
kill_process_tree() {
  local root="$1"
  local kids kid
  if command -v pgrep >/dev/null 2>&1; then
    kids=$(pgrep -P "$root" 2>/dev/null || true)
    for kid in $kids; do
      kill_process_tree "$kid"
    done
  fi
  kill -TERM "$root" 2>/dev/null || true
}

# Run a command. Return the command's status, or 124 when it is still
# running after SECS seconds. Portable bash/sh: do not call GNU timeout.
run_with_timeout() {
  local secs="$1"
  shift
  local flag rc
  flag=$(mktemp "${TMPDIR:-/tmp}/rhizome-pw-timeout.XXXXXX")
  rm -f "$flag"
  rc=0
  (
    "$@" &
    child=$!
    (
      sleep "$secs"
      if kill -0 "$child" 2>/dev/null; then
        printf '%s\n' timed_out > "$flag"
        kill_process_tree "$child"
      fi
    ) &
    watcher=$!
    status=0
    wait "$child" || status=$?
    # The flag is written before the child is killed, so it exists by the
    # time wait returns on the timeout path. On the success path the watcher
    # is still inside sleep and the flag does not exist.
    if [ -f "$flag" ]; then
      kill_process_tree "$watcher"
      wait "$watcher" 2>/dev/null || true
      exit 124
    fi
    kill_process_tree "$watcher"
    wait "$watcher" 2>/dev/null || true
    exit "$status"
  ) || rc=$?
  rm -f "$flag"
  return "$rc"
}

fail_playwright_browser_install() {
  local reason="$1"
  local build="$2"
  local cache
  cache=$(playwright_browser_cache_dir)
  echo "❌ Playwright browser install failed: ${reason}" >&2
  if [ -n "$build" ]; then
    echo "   Browser build: ${build}" >&2
  else
    echo "   Browser build: unknown" >&2
  fi
  echo "   Cache path: ${cache}" >&2
  exit 1
}

ensure_playwright_browser() {
  local limit="${PLAYWRIGHT_INSTALL_TIMEOUT_SECS:-600}"
  local dry_log dry_status build install_status
  case "$limit" in
    ''|*[!0-9]*) limit=600 ;;
  esac

  dry_log=$(mktemp "${TMPDIR:-/tmp}/rhizome-pw-dryrun.XXXXXX")
  dry_status=0
  # Dry-run is captured so the browser build can be read back. It is also
  # timed: a hung dry-run used to sit with no message, same as the install.
  run_with_timeout "$limit" npx --no-install playwright install --dry-run chromium >"$dry_log" 2>&1 || dry_status=$?
  build=$(sed -n 's/.*\(chromium-[0-9][0-9]*\).*/\1/p' "$dry_log" | head -n 1)

  if [ "$dry_status" -eq 124 ]; then
    rm -f "$dry_log"
    fail_playwright_browser_install "dry-run timed out after ${limit}s" "$build"
  fi

  # A dry-run quirk (non-zero, not a timeout) skips install and does not
  # fail the push. Same control flow as before C81.
  if [ "$dry_status" -ne 0 ]; then
    rm -f "$dry_log"
    return 0
  fi

  # Install output is not redirected. A person watching the hook sees progress.
  install_status=0
  run_with_timeout "$limit" npx --no-install playwright install chromium || install_status=$?
  rm -f "$dry_log"

  if [ "$install_status" -eq 124 ]; then
    fail_playwright_browser_install "install timed out after ${limit}s" "$build"
  fi
  if [ "$install_status" -ne 0 ]; then
    fail_playwright_browser_install "install exited ${install_status}" "$build"
  fi
  return 0
}
