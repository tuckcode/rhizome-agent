#!/usr/bin/env node
/**
 * Mechanical Prime adapter surface — so we notice when Prime moves.
 *
 * Rhizome is a daemon client (ADR-0163 / composition option 2). The command
 * set lives in Prime, not in this repo. Coverage prose goes stale the moment
 * they ship (0.7.4's "105 commands" was already wrong on 0.8.0). This script
 * is the cheap check: extract `DAEMON_COMMAND_TYPES` from the *installed*
 * package, extract the `"type"` strings we actually send, and diff both
 * against a committed snapshot.
 *
 * Do not clone PrimeIntellect-ai/prime-agent into this tree. Do not dump
 * the installed package into an agent context. The snapshot is the list.
 *
 *   pnpm prime:surface              # local install vs snapshot
 *   pnpm prime:surface --update     # rewrite snapshot from this machine
 *   pnpm prime:surface --github     # GitHub latest release tag vs snapshot
 */
import { existsSync, readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const repoRoot = path.resolve(import.meta.dirname, '..')
export const SNAPSHOT_PATH = path.join(repoRoot, 'docs/prime-adapter-surface.json')
const GITHUB_LATEST =
  'https://api.github.com/repos/PrimeIntellect-ai/prime-agent/releases/latest'
const USER_AGENT = 'rhizome-agent-prime-surface'

/** Commands a desktop client should never send. ADR-0163: the daemon is not ours to stop.
 *  `reload` is spoken after Settings → Packages install. Do not send it from Chat. */
export const NEVER_CALL = [
  'ack_result',
  'prepare_update_restart',
  'restart',
  'restore_actions',
  'retry_worker',
  'set_transport',
  'shutdown',
]

export function extractDaemonCommandSet(source) {
  const match = source.match(/DAEMON_COMMAND_TYPES\s*=\s*new Set\(/)
  if (!match || match.index === undefined) {
    throw new Error('DAEMON_COMMAND_TYPES not found')
  }
  const start = source.indexOf('(', match.index)
  let depth = 0
  for (let i = start; i < source.length; i += 1) {
    if (source[i] === '(') depth += 1
    else if (source[i] === ')') {
      depth -= 1
      if (depth === 0) {
        const body = source.slice(start, i + 1)
        return uniqueSorted(
          [...body.matchAll(/"([a-zA-Z][a-zA-Z0-9_]*)"/g)].map((item) => item[1]),
        )
      }
    }
  }
  throw new Error('unclosed DAEMON_COMMAND_TYPES')
}

export function extractQuotedTypes(source) {
  return [...source.matchAll(/"type"\s*:\s*"([a-z][a-z0-9_]*)"/g)].map((item) => item[1])
}

export function spokenFromHostSource(source, daemonCommands) {
  const daemon = new Set(daemonCommands)
  return uniqueSorted(extractQuotedTypes(source).filter((name) => daemon.has(name)))
}

export function stripTagPrefix(tag) {
  return tag.replace(/^[vV]/, '')
}

export function isNewerVersion(candidate, installed) {
  const candidateParts = versionComponents(candidate)
  const installedParts = versionComponents(installed)
  if (candidateParts.length === 0 || installedParts.length === 0) return false
  const n = Math.max(candidateParts.length, installedParts.length)
  for (let i = 0; i < n; i += 1) {
    const left = candidateParts[i] ?? 0
    const right = installedParts[i] ?? 0
    if (left > right) return true
    if (left < right) return false
  }
  return false
}

function versionComponents(version) {
  const parts = []
  for (const part of stripTagPrefix(version).split('.')) {
    if (!/^\d+$/.test(part)) break
    parts.push(Number(part))
  }
  return parts
}

export function diffLists(actual, expected) {
  const a = new Set(actual)
  const b = new Set(expected)
  return {
    added: [...a].filter((item) => !b.has(item)).sort(),
    removed: [...b].filter((item) => !a.has(item)).sort(),
  }
}

export function loadSnapshot(jsonText) {
  const snapshot = JSON.parse(jsonText)
  if (!Array.isArray(snapshot.daemonCommands) || !Array.isArray(snapshot.spoken)) {
    throw new Error('snapshot missing daemonCommands or spoken')
  }
  return snapshot
}

export function formatReport({ installed, daemonDiff, spokenDiff, github }) {
  const lines = []
  if (installed) {
    lines.push(`installed prime-agent ${installed.version} (${installed.daemonCommands.length} daemon commands)`)
  } else {
    lines.push('installed prime-agent not found — skipped daemon-set check')
  }
  if (daemonDiff) {
    lines.push(formatDiff('daemonCommands', daemonDiff))
  }
  if (spokenDiff) {
    lines.push(formatDiff('spoken', spokenDiff))
  }
  if (github) {
    lines.push(
      github.newer
        ? `GitHub latest is ${github.tag} (snapshot has ${github.snapshotTag}) — re-audit; do not dump the Prime tree into context`
        : `GitHub latest is still ${github.tag}`,
    )
  }
  return lines.filter(Boolean).join('\n')
}

function formatDiff(label, diff) {
  if (diff.added.length === 0 && diff.removed.length === 0) {
    return `${label}: unchanged`
  }
  const bits = []
  if (diff.added.length) bits.push(`+${diff.added.join(',')}`)
  if (diff.removed.length) bits.push(`-${diff.removed.join(',')}`)
  return `${label}: ${bits.join(' ')}`
}

export function findInstalledPackage(home = homedir()) {
  const candidates = [
    path.join(home, '.local/lib/node_modules/prime-agent'),
    path.join(home, '.npm-global/lib/node_modules/prime-agent'),
    path.join(home, 'AppData/Roaming/npm/node_modules/prime-agent'),
  ]
  for (const dir of candidates) {
    if (existsSync(path.join(dir, 'package.json'))) return dir
  }

  const bin = which('prime-agent')
  if (!bin) return null
  try {
    let current = realpathSync(bin)
    for (let i = 0; i < 8; i += 1) {
      const pkg = path.join(current, 'package.json')
      if (existsSync(pkg) && JSON.parse(readFileSync(pkg, 'utf8')).name === 'prime-agent') {
        return current
      }
      const parent = path.dirname(current)
      if (parent === current) break
      current = parent
    }
  } catch {
    return null
  }
  return null
}

function which(binary) {
  const pathEnv = process.env.PATH ?? ''
  for (const dir of pathEnv.split(path.delimiter)) {
    if (!dir) continue
    for (const name of [binary, `${binary}.cmd`, `${binary}.exe`]) {
      const candidate = path.join(dir, name)
      if (existsSync(candidate)) return candidate
    }
  }
  return null
}

export function readInstalledSurface(packageDir) {
  const pkg = JSON.parse(readFileSync(path.join(packageDir, 'package.json'), 'utf8'))
  const supervisor = path.join(packageDir, 'dist/modes/daemon/daemon-supervisor.js')
  if (!existsSync(supervisor)) {
    throw new Error(`no daemon-supervisor.js in ${packageDir}`)
  }
  return {
    version: String(pkg.version ?? ''),
    daemonCommands: extractDaemonCommandSet(readFileSync(supervisor, 'utf8')),
  }
}

export function readSpoken(hostSource, daemonCommands) {
  return spokenFromHostSource(hostSource, daemonCommands)
}

export function hostSources(root = repoRoot) {
  const dir = path.join(root, 'src-tauri/src')
  return readdirSync(dir)
    .filter((name) => name.startsWith('prime_') && name.endsWith('.rs'))
    .map((name) => readFileSync(path.join(dir, name), 'utf8'))
    .join('\n')
}

function uniqueSorted(values) {
  return [...new Set(values)].sort()
}

export function buildSnapshot({ installed, spoken, githubTag, auditedAt }) {
  return {
    repo: 'PrimeIntellect-ai/prime-agent',
    auditedAt,
    installedVersion: installed.version,
    githubLatestTag: githubTag ?? `v${installed.version}`,
    protocolVersion: 7,
    daemonCommands: installed.daemonCommands,
    spoken,
    neverCall: NEVER_CALL,
  }
}

export async function fetchGithubLatest(fetcher = fetch) {
  const response = await fetcher(GITHUB_LATEST, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/vnd.github+json',
    },
  })
  if (!response.ok) {
    throw new Error(`GitHub returned ${response.status}`)
  }
  const body = await response.json()
  return {
    tag: String(body.tag_name ?? ''),
    url: String(body.html_url ?? ''),
    publishedAt: String(body.published_at ?? ''),
  }
}

function parseArgs(argv) {
  return {
    update: argv.includes('--update'),
    github: argv.includes('--github'),
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const snapshot = existsSync(SNAPSHOT_PATH)
    ? loadSnapshot(readFileSync(SNAPSHOT_PATH, 'utf8'))
    : {
        daemonCommands: [],
        spoken: [],
        githubLatestTag: 'v0.0.0',
      }
  const packageDir = findInstalledPackage()
  const installed = packageDir ? readInstalledSurface(packageDir) : null
  const daemonForSpoken = installed?.daemonCommands ?? snapshot.daemonCommands
  const spoken = readSpoken(hostSources(), daemonForSpoken)

  if (args.update) {
    if (!installed) {
      console.error('Cannot --update without an installed prime-agent package.')
      process.exit(1)
    }
    let githubTag = `v${installed.version}`
    if (args.github) {
      githubTag = (await fetchGithubLatest()).tag
    }
    const next = buildSnapshot({
      installed,
      spoken,
      githubTag,
      auditedAt: new Date().toISOString().slice(0, 10),
    })
    writeFileSync(SNAPSHOT_PATH, `${JSON.stringify(next, null, 2)}\n`)
    console.log(
      `updated ${path.relative(repoRoot, SNAPSHOT_PATH)} — ${installed.version}, ${spoken.length} spoken / ${installed.daemonCommands.length} daemon`,
    )
    return
  }

  const daemonDiff = installed
    ? diffLists(installed.daemonCommands, snapshot.daemonCommands)
    : null
  const spokenDiff = diffLists(spoken, snapshot.spoken)
  let github = null
  if (args.github) {
    const latest = await fetchGithubLatest()
    github = {
      tag: latest.tag,
      snapshotTag: snapshot.githubLatestTag,
      newer: isNewerVersion(latest.tag, snapshot.githubLatestTag),
      url: latest.url,
    }
  }

  const drifted =
    (daemonDiff && (daemonDiff.added.length > 0 || daemonDiff.removed.length > 0)) ||
    spokenDiff.added.length > 0 ||
    spokenDiff.removed.length > 0 ||
    Boolean(github?.newer)

  console.log(
    formatReport({
      installed,
      daemonDiff,
      spokenDiff,
      github,
    }),
  )

  if (drifted) {
    console.error(
      '\nPrime adapter snapshot is stale. Run `pnpm prime:surface --update` after reading the diff — do not ingest the Prime package.',
    )
    process.exit(1)
  }
}

const isDirect =
  process.argv[1] !== undefined && pathToFileURL(process.argv[1]).href === import.meta.url
if (isDirect) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  })
}
