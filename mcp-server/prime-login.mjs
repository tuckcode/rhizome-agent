#!/usr/bin/env node
/**
 * Sign Prime in to a model provider without a terminal.
 *
 * Usage:
 *   node prime-login.mjs <provider>                  # OAuth in the browser
 *   node prime-login.mjs <provider> --key-from-stdin # store an API key
 *
 * Env:
 *   PRIME_AGENT_PACKAGE_DIR  root of the installed prime-agent package
 *
 * Credentials go through Prime's own AuthStorage, so the file format, the
 * lock and the location stay Prime's (ADR-0176). Rhizome only drives it.
 *
 * Stdout is one JSON event per line, read by `prime_login.rs`:
 *   {"event":"open_url","url":"https://claude.ai/oauth/authorize?..."}
 *   {"event":"progress","message":"Exchanging authorization code..."}
 *   {"event":"done"}
 *   {"event":"error","message":"..."}
 */
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const KEY_FROM_STDIN = '--key-from-stdin'

/**
 * Run one sign-in. `mode` is `browser` (OAuth) or `key` (store a pasted key).
 * Never throws: failures become an `error` event.
 */
export async function runPrimeLogin({ provider, mode, authStorage, emit, readKey }) {
  try {
    if (mode === 'browser') {
      const usesOAuth = authStorage.getOAuthProviders().some((entry) => entry.id === provider)
      if (!usesOAuth) {
        emit({
          event: 'error',
          message: `Prime has no browser sign-in for ${provider}. A Prime extension can add one (~/.prime/agent/extensions).`,
        })
        return
      }
      await authStorage.login(provider, {
        onAuth: ({ url }) => emit({ event: 'open_url', url }),
        onProgress: (message) => emit({ event: 'progress', message }),
        // Only reached when the browser never returns to the callback server.
        onPrompt: async () => {
          throw new Error('The browser sign-in did not return to Rhizome. Try again.')
        },
      })
      emit({ event: 'done' })
      return
    }

    const key = (await readKey()).trim()
    if (!key) {
      emit({ event: 'error', message: 'No API key was entered.' })
      return
    }
    authStorage.set(provider, { type: 'api_key', key })
    emit({ event: 'done' })
  } catch (error) {
    emit({ event: 'error', message: error instanceof Error ? error.message : String(error) })
  }
}

async function readStdin() {
  let text = ''
  for await (const chunk of process.stdin) {
    text += chunk
  }
  return text
}

async function main() {
  const [provider, mode] = process.argv.slice(2)
  const emit = (event) => process.stdout.write(`${JSON.stringify(event)}\n`)

  const packageDir = process.env.PRIME_AGENT_PACKAGE_DIR
  if (!provider || !packageDir) {
    emit({ event: 'error', message: 'prime-login needs a provider and PRIME_AGENT_PACKAGE_DIR.' })
    process.exitCode = 1
    return
  }

  // Prime's public entry point; resolves its own dependencies from there.
  const primeEntry = pathToFileURL(path.join(packageDir, 'dist', 'index.js')).href
  const prime = await import(primeEntry)
  const authStorage = prime.AuthStorage.create()
  await registerExtensionProviders(prime, authStorage)

  const keyMode = mode === KEY_FROM_STDIN
  await runPrimeLogin({
    provider,
    mode: keyMode ? 'key' : 'browser',
    authStorage,
    emit,
    readKey: keyMode ? readStdin : async () => '',
  })
}

/**
 * Load the user's Prime extensions and register their providers, the way
 * Prime does when a session starts. An extension can add a browser sign-in
 * (e.g. `xai-oauth.ts`); without this step `/login` has it and Rhizome not.
 */
async function registerExtensionProviders(prime, authStorage) {
  const registry = prime.ModelRegistry.create(authStorage)
  const loaded = await prime.discoverAndLoadExtensions([], os.homedir())
  for (const { name, config } of loaded.runtime.pendingProviderRegistrations) {
    try {
      registry.registerProvider(name, config)
    } catch {
      // A broken extension must not block signing in to anything else.
    }
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main()
}
