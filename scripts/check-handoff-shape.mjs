#!/usr/bin/env node
/**
 * Keeps `docs/HANDOFF.md` an index rather than an archive.
 *
 * Per-PR notes belong in `docs/plans/handoffs/` (one new file each). A PR
 * must not append a State, Recent, or Open-threads line to HANDOFF.md —
 * that is how parallel PRs conflicted on merge. This check still forbids
 * inline `## Session handoff` sections, caps the index at 900 lines, and
 * requires frontmatter on each handoff file.
 */
import { readFileSync, readdirSync } from 'node:fs'

const HANDOFF = 'docs/HANDOFF.md'
const HANDOFF_DIR = 'docs/plans/handoffs'
const MAX_LINES = 900

const problems = []
const handoff = readFileSync(HANDOFF, 'utf8')

if (!handoff.includes('New PRs must not edit this file')) {
  problems.push(
    `${HANDOFF} is missing the per-PR pointer.`,
    `  New PRs add a file under ${HANDOFF_DIR}/; they must not append a line here.`,
  )
}

const sessionSections = handoff.match(/^## Session handoff/gm) ?? []
if (sessionSections.length > 0) {
  problems.push(
    `${HANDOFF} has ${sessionSections.length} "## Session handoff" section(s).`,
    `  Session records belong in ${HANDOFF_DIR}/, one file each — see the top of ${HANDOFF}.`,
  )
}

const lines = handoff.split('\n').length
if (lines > MAX_LINES) {
  problems.push(
    `${HANDOFF} is ${lines} lines (limit ${MAX_LINES}).`,
    '  It is read in full every session, so it holds current state and an index — not history.',
    '  Move closed threads and finished work out, or into a handoff file.',
  )
}

// Every handoff file must carry the frontmatter a future session reads to
// decide whether to open it. A file without `description` costs someone the
// whole read to find out it was irrelevant.
for (const name of readdirSync(HANDOFF_DIR).filter((f) => f.endsWith('.md') && !f.startsWith('archive'))) {
  // Normalise CRLF: Windows checkouts with core.autocrlf=true get \r\n.
  const body = readFileSync(`${HANDOFF_DIR}/${name}`, 'utf8').replace(/\r\n/g, '\n')
  if (!body.startsWith('---\n')) {
    problems.push(`${HANDOFF_DIR}/${name} has no frontmatter.`)
    continue
  }
  const front = body.slice(4, body.indexOf('\n---', 4))
  for (const key of ['session', 'model', 'description']) {
    if (!new RegExp(`^${key}:`, 'm').test(front)) {
      problems.push(`${HANDOFF_DIR}/${name} frontmatter is missing \`${key}\`.`)
    }
  }
}

if (problems.length > 0) {
  console.error('Handoff shape check failed:\n')
  for (const line of problems) console.error(line)
  process.exit(1)
}

console.log(
  `Handoff shape OK — ${lines} lines, no session sections inline, per-PR files in ${HANDOFF_DIR}/.`,
)
