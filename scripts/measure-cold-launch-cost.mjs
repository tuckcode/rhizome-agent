#!/usr/bin/env node
/**
 * Time the cold-launch transcript remount and the Sessions rail.
 * One warmup, then fifteen iterations. Median of each.
 *
 *   node scripts/measure-cold-launch-cost.mjs
 */

import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const result = spawnSync(
  'pnpm',
  ['exec', 'vitest', 'run', 'src/utils/coldLaunchCost.bench.test.tsx'],
  {
    cwd: root,
    env: { ...process.env, COLD_LAUNCH_BENCH: '1' },
    stdio: 'inherit',
  },
)

process.exit(result.status ?? 1)
