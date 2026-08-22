#!/usr/bin/env node
/**
 * How much of the test suite is still exempt from the typecheck, and why.
 *
 * `pnpm typecheck` gates every test file except the ones `tsconfig.test.json`
 * excludes — a ratchet, not a wall: 386 of 533 test files were already clean
 * when the project was introduced (2026-08-21), so gating them costs nothing
 * and stops new test files from joining the backlog. This script reports what
 * is left, so the exclusion list shrinks on purpose rather than by accident.
 *
 * Deliberately not a gate. A blocking check with a standing backlog is a check
 * people learn to bypass — the same reasoning that keeps `pnpm deadcode`
 * advisory. Run it when you touch a file it names.
 */

import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const config = JSON.parse(readFileSync('tsconfig.test.json', 'utf8'))
const excluded = config.exclude ?? []

// The same project with nothing exempt. Written beside the real one so its
// relative `extends` and `include` paths still resolve.
const probePath = join(process.cwd(), `tsconfig.test.backlog.${process.pid}.json`)
const scratch = mkdtempSync(join(tmpdir(), 'typecheck-backlog-'))
writeFileSync(
  probePath,
  JSON.stringify(
    {
      ...config,
      compilerOptions: {
        ...config.compilerOptions,
        tsBuildInfoFile: join(scratch, 'backlog.tsbuildinfo'),
      },
      exclude: [],
    },
    null,
    2,
  ),
)

let output = ''
try {
  execFileSync('npx', ['tsc', '-p', probePath, '--noEmit'], { encoding: 'utf8' })
} catch (error) {
  // A non-zero exit is the expected case: it means there is still a backlog.
  output = `${error.stdout ?? ''}${error.stderr ?? ''}`
} finally {
  rmSync(probePath, { force: true })
  rmSync(scratch, { recursive: true, force: true })
}

const byFile = new Map()
let vendored = 0
for (const line of output.split('\n')) {
  const match = /^(.+?)\(\d+,\d+\): error TS\d+/.exec(line)
  if (!match) continue
  // Two regression tests import BlockNote's raw `.ts` source by relative path
  // rather than through the package, which drags ~500 errors out of a library
  // we do not own and `skipLibCheck` cannot help with (it skips `.d.ts`, not
  // `.ts`). Counting those as our backlog would make it look untouchable.
  if (match[1].startsWith('node_modules/')) {
    vendored += 1
    continue
  }
  byFile.set(match[1], (byFile.get(match[1]) ?? 0) + 1)
}

const ranked = [...byFile.entries()].sort((a, b) => b[1] - a[1])
const total = ranked.reduce((sum, [, count]) => sum + count, 0)

if (total === 0) {
  console.log('No backlog: every test file typechecks. Empty `exclude` in tsconfig.test.json.')
  process.exit(0)
}

console.log(`${total} errors across ${ranked.length} files, all currently excluded from the gate.`)
console.log(`tsconfig.test.json excludes ${excluded.length} files.`)
if (vendored > 0) {
  console.log(
    `${vendored} further errors inside node_modules are not counted: they come from the two ` +
      'tests that import BlockNote source by relative path.',
  )
}
console.log('')
console.log('Worst first — clearing one means deleting its line from `exclude`:\n')
for (const [file, count] of ranked.slice(0, 20)) {
  console.log(`  ${String(count).padStart(4)}  ${file}`)
}
if (ranked.length > 20) console.log(`  ... and ${ranked.length - 20} more files`)
