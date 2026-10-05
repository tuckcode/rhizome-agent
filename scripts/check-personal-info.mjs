#!/usr/bin/env node
// Pre-commit: block personal home paths and personal email addresses in
// lines a commit adds. The repository is public; write `~/…`, `<repo>/…`
// or `%LOCALAPPDATA%\…` instead. Existing lines are not checked.
//
// e.g. `C:\Users\<name>\Downloads` with a real name → flagged, `~/Downloads` → fine.
// A line that must keep its value can carry `personal-info: allow`.

import { execFileSync } from 'node:child_process'
import { userInfo } from 'node:os'
import { pathToFileURL } from 'node:url'

const ALLOW_MARKER = 'personal-info: allow'

// Extra real usernames to block, comma-separated, e.g. other machines'.
const NAMES_ENV = 'PERSONAL_INFO_NAMES'

const HOME_PATTERNS = [
  /[A-Za-z]:[\\/]+Users[\\/]+([^\\/\s'"`<>]+)/g,
  /\/Users\/([^/\s'"`<>]+)\//g,
  /\/home\/([^/\s'"`<>]+)\//g,
]

const PERSONAL_EMAIL = /[\w.+-]+@(?:gmail|googlemail|outlook|hotmail|live|icloud|me|yahoo|proton|protonmail)\.(?:com|me)\b/i

const HUNK_HEADER = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/

// Only listed names count: made-up fixture homes (`/Users/mock/`) pass.
function hasRealHome(text, names) {
  for (const pattern of HOME_PATTERNS) {
    for (const match of text.matchAll(pattern)) {
      if (names.has(match[1].toLowerCase())) {
        return true
      }
    }
  }

  return false
}

function classify(text, names) {
  if (text.includes(ALLOW_MARKER)) {
    return null
  }

  if (hasRealHome(text, names)) {
    return 'home path'
  }

  if (PERSONAL_EMAIL.test(text)) {
    return 'personal email'
  }

  return null
}

/** Scan a unified diff; report only added lines. */
export function findPersonalInfo(diff, options) {
  const names = new Set(options.names.map(name => name.toLowerCase()))
  const findings = []
  let file = ''
  let line = 0

  for (const raw of diff.split('\n')) {
    // Track the file and the new-side line number of each hunk.
    if (raw.startsWith('+++ ')) {
      file = raw.replace(/^\+\+\+ (b\/)?/, '')
      continue
    }

    const hunk = HUNK_HEADER.exec(raw)
    if (hunk) {
      line = Number(hunk[1])
      continue
    }

    if (raw.startsWith('-')) {
      continue
    }

    if (!raw.startsWith('+')) {
      line += 1
      continue
    }

    const text = raw.slice(1)
    const kind = classify(text, names)
    if (kind) {
      findings.push({ file, line, kind, text })
    }

    line += 1
  }

  return findings
}

// This machine's account name, plus any names in PERSONAL_INFO_NAMES.
function realNames() {
  const extra = (process.env[NAMES_ENV] ?? '').split(',').map(name => name.trim())
  return [userInfo().username, ...extra].filter(Boolean)
}

function main() {
  const diff = execFileSync('git', ['diff', '--cached', '-U0', '--no-color'], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })
  const findings = findPersonalInfo(diff, { names: realNames() })

  if (findings.length === 0) {
    return
  }

  console.error('❌ Personal info in staged lines (repository is public):')
  for (const { file, line, kind, text } of findings) {
    console.error(`   ${file}:${line} ${kind}: ${text.trim().slice(0, 120)}`)
  }
  console.error(`   Use ~/…, <repo>/… or a fixture name, or add "${ALLOW_MARKER}" to the line.`)
  process.exit(1)
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main()
}
