#!/usr/bin/env node
/**
 * Run the Rust tests that need a real Prime daemon.
 *
 * Six of them exist in `prime_session_host.rs`, `#[ignore]`d, and until now
 * nothing ran them — they were written and then had no lane. That is the gap
 * `docs/plans/2026-08-22-prime-harness-coverage.md` calls the highest-leverage
 * infrastructure work available: every test in that file otherwise runs
 * against a fake daemon over a `UnixListener`, which proves command ordering
 * and nothing about shape.
 *
 * Deliberately NOT in the push gate. It needs a daemon, it talks to the real
 * `~/.prime/agent`, and a gate that depends on a background service on the
 * developer's machine is a gate that fails for reasons unrelated to the diff.
 * Run it when touching the adapter.
 *
 * Scoped to `prime_session_host` on purpose. `cargo test -- --ignored` also
 * picks up live tests for distill and repo-research, which need Claude Code
 * signed in and fail on an expired OAuth token — nothing to do with the
 * daemon, and the kind of noise that gets a lane ignored.
 *
 * Several of these have preconditions they state themselves: a started
 * session, a scheduled job, `PRIME_SESSION_LOG`. A failure naming what to set
 * up is that, not a defect in the adapter — read the message before believing
 * the adapter is broken.
 */
import { spawnSync } from 'node:child_process'

const MANIFEST = 'src-tauri/Cargo.toml'

function run(command, args, options = {}) {
  return spawnSync(command, args, { encoding: 'utf8', ...options })
}

function daemonIsUp() {
  const status = run('prime-agent', ['status'])
  if (status.error) return { up: false, reason: 'prime-agent is not on PATH' }
  if (status.status !== 0) {
    return { up: false, reason: (status.stderr || status.stdout || '').trim().split('\n')[0] }
  }
  return { up: true }
}

const check = daemonIsUp()
if (!check.up) {
  // A skip, not a failure. Someone running this without a daemon has not
  // broken anything — they just cannot answer the question it asks.
  console.log(`live Prime tests skipped — ${check.reason || 'no daemon'}`)
  console.log('start one with:  (prime-agent --mode daemon >/dev/null 2>&1 &) && sleep 2')
  process.exit(0)
}

console.log('running the live-daemon Rust tests (ignored by the normal suite)…')
const result = run(
  'cargo',
  [
    'test',
    '--manifest-path',
    MANIFEST,
    '--lib',
    'prime_session_host::tests',
    '--',
    '--ignored',
    // These share one process-global host and the real socket. In parallel
    // they fight over both.
    '--test-threads=1',
  ],
  { stdio: 'inherit' },
)

process.exit(result.status ?? 1)
