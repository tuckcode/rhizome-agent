#!/usr/bin/env node
/**
 * Run the Rust tests that need a real Prime daemon, against a scratch store.
 *
 * The ignored tests in `prime_session_host.rs` used to clear
 * `RHIZOME_PRIME_DAEMON_SOCKET` and fall through to the default daemon, which
 * writes session logs into `~/.prime/agent/sessions`. One run left husk
 * sessions there (C39). This script starts its own supervisor with a short
 * pre-created socket and a scratch `--session-dir`, then refuses to run the
 * suite unless both are set. It never points the tests at the default socket.
 *
 * Deliberately NOT in the push gate. It needs a daemon. A failure that names
 * its own missing setup (a scheduled job, a started session) is that, not a
 * defect in the adapter — read the message before believing the adapter is
 * broken.
 */
import { spawn, spawnSync } from 'node:child_process'
import { mkdirSync, readdirSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const MANIFEST = 'src-tauri/Cargo.toml'
const uid = typeof process.getuid === 'function' ? process.getuid() : os.userInfo().uid
const root = '/tmp/rzlive'
const tmp = path.join(root, 'tmp')
const sockDir = path.join(tmp, `prime-agent-${uid}`)
const sock = path.join(sockDir, 'daemon.sock')
const sessions = path.join(root, 'sessions')

if (sock.length > 100) {
  console.error(`live Prime socket path is too long for AF_UNIX: ${sock}`)
  process.exit(1)
}

function snapshotRealSessions() {
  const dir = path.join(os.homedir(), '.prime', 'agent', 'sessions')
  try {
    return new Set(readdirSync(dir))
  } catch {
    return new Set()
  }
}

function precreateSocket() {
  mkdirSync(sockDir, { recursive: true })
  mkdirSync(sessions, { recursive: true })
  rmSync(sock, { force: true })
  const created = spawnSync(
    'python3',
    [
      '-c',
      'import socket,sys; s=socket.socket(socket.AF_UNIX); s.bind(sys.argv[1]); s.close()',
      sock,
    ],
    { encoding: 'utf8' },
  )
  if (created.status !== 0) {
    console.error(created.stderr || created.stdout || 'could not pre-create the scratch socket')
    process.exit(created.status ?? 1)
  }
}

function waitForSocket(child) {
  const deadline = Date.now() + 15_000
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`isolated Prime daemon exited before it was listening (code ${child.exitCode})`)
    }
    const probe = spawnSync(
      'python3',
      [
        '-c',
        'import socket,sys; s=socket.socket(socket.AF_UNIX); s.settimeout(0.2); s.connect(sys.argv[1]); s.close()',
        sock,
      ],
      { encoding: 'utf8' },
    )
    if (probe.status === 0) return
    spawnSync('sleep', ['0.1'])
  }
  throw new Error(`isolated Prime daemon did not listen on ${sock}`)
}

const before = snapshotRealSessions()
precreateSocket()

const child = spawn(
  'prime-agent',
  ['--mode', 'daemon', '--daemon-socket', sock, '--session-dir', sessions],
  {
    detached: true,
    stdio: 'ignore',
  },
)
child.unref()

function stopDaemon() {
  try {
    process.kill(-child.pid, 'SIGTERM')
  } catch {
    try {
      process.kill(child.pid, 'SIGTERM')
    } catch {
      // already gone
    }
  }
}

let exitCode = 1
try {
  waitForSocket(child)
  console.log(`running live Prime tests against ${sock}`)
  console.log(`scratch session dir ${sessions}`)
  const result = spawnSync(
    'cargo',
    [
      'test',
      '--manifest-path',
      MANIFEST,
      '--lib',
      'prime_session_host::tests',
      '--',
      '--ignored',
      '--test-threads=1',
    ],
    {
      stdio: 'inherit',
      env: {
        ...process.env,
        RHIZOME_PRIME_DAEMON_SOCKET: sock,
        RHIZOME_PRIME_SESSION_DIR: sessions,
      },
    },
  )
  exitCode = result.status ?? 1
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  exitCode = 1
} finally {
  stopDaemon()
  rmSync(sessions, { recursive: true, force: true })
  rmSync(sock, { force: true })
}

const after = snapshotRealSessions()
const created = [...after].filter((name) => !before.has(name))
if (created.length > 0) {
  console.error(`live Prime tests left ${created.length} new file(s) in ~/.prime/agent/sessions`)
  for (const name of created) console.error(`  ${name}`)
  process.exit(1)
}

console.log('live Prime tests left no new files in ~/.prime/agent/sessions')
process.exit(exitCode)
