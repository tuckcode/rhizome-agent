/**
 * Bundle the mcp-server Node.js files into self-contained bundles
 * that can be shipped as Tauri resources inside the .app bundle.
 *
 * Output: src-tauri/resources/mcp-server/{index.js,ws-bridge.js,cli-call.mjs}
 *
 * `cli-call.mjs` is what the seeded `rhizome-vault` skill tells agents to run.
 * Omitting it made packaged `seed_vault_skill` fail (no file next to index.js)
 * and left vault/graph tools broken for every installed-app user.
 */
import { build } from 'esbuild'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { copyFileSync, mkdirSync, writeFileSync, existsSync, unlinkSync } from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const SRC = join(ROOT, 'mcp-server')
const OUT = join(ROOT, 'src-tauri', 'resources', 'mcp-server')

mkdirSync(OUT, { recursive: true })

// Tell Node.js that this directory contains CJS bundles, even if the
// root package.json declares "type": "module". `.mjs` stays ESM regardless.
writeFileSync(join(OUT, 'package.json'), JSON.stringify({ type: 'commonjs' }))

const shared = {
  platform: 'node',
  bundle: true,
  target: 'node18',
  // Mark optional native bindings as external — ws works fine without them
  external: ['bufferutil', 'utf-8-validate'],
  logLevel: 'warning',
}

await build({
  ...shared,
  format: 'cjs',
  entryPoints: [join(SRC, 'index.js')],
  outfile: join(OUT, 'index.js'),
})

await build({
  ...shared,
  format: 'cjs',
  entryPoints: [join(SRC, 'ws-bridge.js')],
  outfile: join(OUT, 'ws-bridge.js'),
})

// ESM + createRequire so bundled deps that still `require()` Node builtins work,
// while keeping top-level await from the source entry.
await build({
  ...shared,
  format: 'esm',
  entryPoints: [join(SRC, 'cli-call.mjs')],
  outfile: join(OUT, 'cli-call.mjs'),
  banner: {
    js: "import { createRequire as __cliCreateRequire } from 'module'; const require = __cliCreateRequire(import.meta.url);",
  },
})

// Settings sign-in (ADR-0176). No dependencies of its own: it imports the
// installed Prime package at runtime, so it ships unbundled.
copyFileSync(join(SRC, 'prime-login.mjs'), join(OUT, 'prime-login.mjs'))

// Drop a failed CJS attempt if present.
const staleCjs = join(OUT, 'cli-call.js')
if (existsSync(staleCjs)) unlinkSync(staleCjs)

const required = ['index.js', 'ws-bridge.js', 'cli-call.mjs', 'prime-login.mjs', 'package.json']
for (const name of required) {
  const path = join(OUT, name)
  if (!existsSync(path)) {
    throw new Error(`mcp-server bundle missing required file: ${path}`)
  }
}

console.log('mcp-server bundled → src-tauri/resources/mcp-server/ (index, ws-bridge, cli-call, prime-login)')
