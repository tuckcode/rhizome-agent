#!/bin/sh
# Stub test for ensure_playwright_browser. Does not call real Playwright.
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
HELPER="$ROOT/.husky/ensure-playwright-browser.sh"

passed=0
failed=0

pass() {
  echo "PASS: $1"
  passed=$((passed + 1))
}

fail() {
  echo "FAIL: $1"
  failed=$((failed + 1))
}

assert_eq() {
  if [ "$2" = "$3" ]; then
    pass "$1"
  else
    fail "$1 — expected [$3] got [$2]"
  fi
}

assert_status_zero() {
  if [ "$2" -eq 0 ]; then
    pass "$1"
  else
    fail "$1 — status $2, output follows"
    printf '%s\n' "$3"
  fi
}

assert_status_nonzero() {
  if [ "$2" -ne 0 ]; then
    pass "$1"
  else
    fail "$1 — expected non-zero status, output follows"
    printf '%s\n' "$3"
  fi
}

assert_contains() {
  if printf '%s\n' "$2" | grep -F -q -- "$3"; then
    pass "$1"
  else
    fail "$1 — missing [$3], output follows"
    printf '%s\n' "$2"
  fi
}

assert_not_contains() {
  if printf '%s\n' "$2" | grep -F -q -- "$3"; then
    fail "$1 — unexpected [$3], output follows"
    printf '%s\n' "$2"
  else
    pass "$1"
  fi
}

# Run ensure_playwright_browser in a subshell. Failure uses exit 1, which
# must not kill this test script. stdout and stderr are both captured.
run_ensure() {
  run_status=0
  run_out=$(
    set -e
    # shellcheck disable=SC1091
    . "$HELPER"
    ensure_playwright_browser 2>&1
  ) || run_status=$?
}

setup_fake_npx() {
  fake_bin=$(mktemp -d "${TMPDIR:-/tmp}/rhizome-fake-npx.XXXXXX")
  fake_log=$(mktemp "${TMPDIR:-/tmp}/rhizome-fake-npx-log.XXXXXX")
  cat > "$fake_bin/npx" << 'EOF'
#!/bin/sh
printf '%s\n' "$*" >> "${FAKE_NPX_LOG:?}"
case "$*" in
  *--dry-run*)
    case "${FAKE_NPX_MODE:-ok}" in
      dry-fail)
        echo "dry-run failed from stub" >&2
        exit 1
        ;;
      dry-hang)
        echo "Install location: chromium-1208"
        exec sleep 30
        ;;
      *)
        echo "Install location: chromium-1208"
        exit 0
        ;;
    esac
    ;;
esac
case "${FAKE_NPX_MODE:-ok}" in
  hang)
    echo "install progress line"
    exec sleep 30
    ;;
  fail)
    echo "STUB_INSTALL_STDOUT"
    exit 1
    ;;
  *)
    echo "install progress line"
    exit 0
    ;;
esac
EOF
  chmod +x "$fake_bin/npx"
  PATH="$fake_bin:$PATH"
  export PATH FAKE_NPX_LOG="$fake_log"
}

cleanup_fake_npx() {
  if [ -n "${fake_bin:-}" ]; then
    rm -rf "$fake_bin"
  fi
  if [ -n "${fake_log:-}" ]; then
    rm -f "$fake_log"
  fi
}

cache_dir_for() {
  _uname_s="$1"
  _os_val="$2"
  _home="$3"
  _local="$4"
  _profile="$5"
  _xdg="$6"
  (
    # shellcheck disable=SC1091
    . "$HELPER"
    uname() { printf '%s\n' "$_uname_s"; }
    HOME="$_home"
    export HOME
    if [ -n "$_os_val" ]; then
      OS="$_os_val"
      export OS
    else
      unset OS
    fi
    if [ -n "$_local" ]; then
      LOCALAPPDATA="$_local"
      export LOCALAPPDATA
    else
      unset LOCALAPPDATA
    fi
    if [ -n "$_profile" ]; then
      USERPROFILE="$_profile"
      export USERPROFILE
    else
      unset USERPROFILE
    fi
    if [ -n "$_xdg" ]; then
      XDG_CACHE_HOME="$_xdg"
      export XDG_CACHE_HOME
    else
      unset XDG_CACHE_HOME
    fi
    playwright_browser_cache_dir
  )
}

echo "cache path by OS"
assert_eq "Darwin cache" \
  "$(cache_dir_for Darwin "" /tmp/home "" "" "")" \
  "/tmp/home/Library/Caches/ms-playwright"
assert_eq "MINGW cache uses LOCALAPPDATA" \
  "$(cache_dir_for MINGW64_NT-10.0 "" /tmp/home /tmp/local /tmp/profile "")" \
  "/tmp/local/ms-playwright"
assert_eq "OS=Windows_NT cache uses USERPROFILE fallback" \
  "$(cache_dir_for Linux Windows_NT /tmp/home "" /tmp/profile "")" \
  "/tmp/profile/AppData/Local/ms-playwright"
assert_eq "other OS cache uses XDG_CACHE_HOME" \
  "$(cache_dir_for Linux "" /tmp/home "" "" /tmp/xdg)" \
  "/tmp/xdg/ms-playwright"
assert_eq "other OS cache falls back to HOME/.cache" \
  "$(cache_dir_for Linux "" /tmp/home "" "" "")" \
  "/tmp/home/.cache/ms-playwright"

echo "ensure_playwright_browser"
setup_fake_npx
trap cleanup_fake_npx EXIT

FAKE_NPX_MODE=ok
export FAKE_NPX_MODE
PLAYWRIGHT_INSTALL_TIMEOUT_SECS=600
export PLAYWRIGHT_INSTALL_TIMEOUT_SECS
: > "$fake_log"
run_ensure
assert_status_zero "dry-run and install both exit 0" "$run_status" "$run_out"
assert_not_contains "success has no failure banner" "$run_out" "Playwright browser install failed"
assert_contains "success shows install stdout" "$run_out" "install progress line"
if grep -q -- '--dry-run' "$fake_log" && grep -q 'install chromium' "$fake_log"; then
  pass "success ran dry-run and install"
else
  fail "success ran dry-run and install — log follows"
  cat "$fake_log"
fi

FAKE_NPX_MODE=hang
export FAKE_NPX_MODE
PLAYWRIGHT_INSTALL_TIMEOUT_SECS=1
export PLAYWRIGHT_INSTALL_TIMEOUT_SECS
: > "$fake_log"
hang_start=$(date +%s)
run_ensure
hang_elapsed=$(($(date +%s) - hang_start))
assert_status_nonzero "install sleep times out" "$run_status" "$run_out"
assert_contains "timeout names the browser build" "$run_out" "chromium-1208"
assert_contains "timeout names the cache path" "$run_out" "$HOME/Library/Caches/ms-playwright"
assert_contains "timeout shows install stdout" "$run_out" "install progress line"
if [ "$hang_elapsed" -lt 10 ]; then
  pass "timeout returned in ${hang_elapsed}s"
else
  fail "timeout returned in ${hang_elapsed}s — expected under 10s"
fi

FAKE_NPX_MODE=fail
export FAKE_NPX_MODE
PLAYWRIGHT_INSTALL_TIMEOUT_SECS=600
export PLAYWRIGHT_INSTALL_TIMEOUT_SECS
run_ensure
assert_status_nonzero "install exit 1 fails the function" "$run_status" "$run_out"
assert_contains "install failure names the browser build" "$run_out" "chromium-1208"
assert_contains "install failure names the cache path" "$run_out" "$HOME/Library/Caches/ms-playwright"
assert_contains "install failure shows stub stdout" "$run_out" "STUB_INSTALL_STDOUT"

FAKE_NPX_MODE=dry-fail
export FAKE_NPX_MODE
: > "$fake_log"
run_ensure
assert_status_zero "dry-run non-zero continues" "$run_status" "$run_out"
assert_not_contains "dry-run quirk has no failure banner" "$run_out" "Playwright browser install failed"
if grep -q -- '--dry-run' "$fake_log" && ! grep -q 'install chromium$' "$fake_log"; then
  # The dry-run line also contains the word install. Require no second
  # invocation that is the real install (no --dry-run).
  install_lines=$(grep -c -- '--dry-run' "$fake_log" || true)
  total_lines=$(wc -l < "$fake_log" | tr -d ' ')
  if [ "$install_lines" = "$total_lines" ]; then
    pass "dry-run failure did not start install"
  else
    fail "dry-run failure did not start install — log follows"
    cat "$fake_log"
  fi
else
  fail "dry-run failure did not start install — log follows"
  cat "$fake_log"
fi

FAKE_NPX_MODE=dry-hang
export FAKE_NPX_MODE
PLAYWRIGHT_INSTALL_TIMEOUT_SECS=1
export PLAYWRIGHT_INSTALL_TIMEOUT_SECS
dry_start=$(date +%s)
run_ensure
dry_elapsed=$(($(date +%s) - dry_start))
assert_status_nonzero "dry-run sleep times out" "$run_status" "$run_out"
assert_contains "dry-run timeout names the browser build" "$run_out" "chromium-1208"
assert_contains "dry-run timeout names the cache path" "$run_out" "$HOME/Library/Caches/ms-playwright"
if [ "$dry_elapsed" -lt 10 ]; then
  pass "dry-run timeout returned in ${dry_elapsed}s"
else
  fail "dry-run timeout returned in ${dry_elapsed}s — expected under 10s"
fi

echo ""
echo "${passed} passed, ${failed} failed"
if [ "$failed" -ne 0 ]; then
  exit 1
fi
exit 0
