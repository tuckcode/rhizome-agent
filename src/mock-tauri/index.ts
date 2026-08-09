/**
 * Mock Tauri invoke for browser testing.
 * When running outside Tauri (e.g. in Chrome via localhost:5173),
 * this provides realistic test data so the UI can be verified visually.
 */

import { MOCK_CONTENT } from './mock-content'
import { mockHandlers, addMockEntry, updateMockContent, trackMockChange } from './mock-handlers'
import { tryVaultApi } from './vault-api'

export { addMockEntry, updateMockContent, trackMockChange }

type MockHandler = (args: Record<string, unknown> | undefined) => unknown

export function isTauri(): boolean {
  if (typeof globalThis !== 'undefined' && typeof (globalThis as { isTauri?: unknown }).isTauri === 'boolean') {
    return Boolean((globalThis as { isTauri?: unknown }).isTauri)
  }

  return typeof window !== 'undefined' && ('__TAURI__' in window || '__TAURI_INTERNALS__' in window)
}

// Initialize window globals for browser testing and Playwright overrides
if (typeof window !== 'undefined') {
  window.__mockContent = MOCK_CONTENT
  window.__mockHandlers = mockHandlers
}

function resolveMockHandler(command: string) {
  const windowHandler = typeof window === 'undefined' || !window.__mockHandlers
    ? undefined
    : Reflect.get(window.__mockHandlers, command) as MockHandler | undefined
  return windowHandler ?? Reflect.get(mockHandlers, command) as MockHandler | undefined
}

export async function mockInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  // The mock layer is bundled into the app but must only ever serve data in
  // dev/test. Reaching it in a production build means isTauri() misfired — the
  // real backend isn't wired, and callers would silently get placeholder
  // ([mock-...]) data. Fail loudly instead of masking a broken build.
  if (import.meta.env.PROD) {
    throw new Error(
      `mock Tauri invoked in a production build (command: ${cmd}) — the Tauri backend is not available`,
    )
  }

  const vaultResult = await tryVaultApi<T>(cmd, args)
  if (vaultResult !== undefined) return vaultResult

  const handler = resolveMockHandler(cmd)
  if (handler) {
    await new Promise((r) => setTimeout(r, 100))
    return handler(args) as T
  }
  throw new Error(`No mock handler for command: ${cmd}`)
}
