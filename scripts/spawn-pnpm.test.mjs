import assert from 'node:assert/strict'
import test from 'node:test'

import { spawnPnpm } from './spawn-pnpm.mjs'

// Regression for C82: `spawn('pnpm')` fails ENOENT on Windows, where pnpm
// is a `.cmd` shim. The pre-push coverage and smoke lanes both hit it.
test('spawnPnpm runs pnpm on every platform', async () => {
  let stdout = ''
  const exitCode = await new Promise((resolve, reject) => {
    const child = spawnPnpm(['--version'], { stdio: ['ignore', 'pipe', 'inherit'] })
    child.stdout.on('data', (chunk) => { stdout += chunk })
    child.on('error', reject)
    child.on('exit', resolve)
  })

  assert.equal(exitCode, 0)
  assert.match(stdout.trim(), /^\d+\.\d+\.\d+/)
})
