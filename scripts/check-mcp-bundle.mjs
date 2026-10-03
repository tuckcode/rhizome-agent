/**
 * Gate: packaged mcp-server must include cli-call.mjs (C69).
 * Run after `pnpm bundle-mcp` / as part of release readiness.
 */
import { existsSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const out = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'src-tauri',
  'resources',
  'mcp-server',
)
const required = ['index.js', 'ws-bridge.js', 'cli-call.mjs', 'prime-login.mjs', 'package.json']
const missing = required.filter((name) => !existsSync(join(out, name)))
if (missing.length) {
  console.error(`mcp-server bundle incomplete under ${out}: missing ${missing.join(', ')}`)
  console.error('Run: pnpm bundle-mcp')
  process.exit(1)
}
console.log('mcp-server bundle OK (index, ws-bridge, cli-call, prime-login)')
