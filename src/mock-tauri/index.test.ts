import { afterEach, describe, expect, it, vi } from 'vitest'
import { isTauri, mockInvoke } from './index'

const originalIsTauri = (globalThis as { isTauri?: unknown }).isTauri
const windowWithLegacyMarkers = window as Window & {
  __TAURI__?: unknown
  __TAURI_INTERNALS__?: unknown
}

describe('isTauri', () => {
  afterEach(() => {
    if (originalIsTauri === undefined) {
      delete (globalThis as { isTauri?: unknown }).isTauri
    } else {
      ;(globalThis as { isTauri?: unknown }).isTauri = originalIsTauri
    }

    delete windowWithLegacyMarkers.__TAURI__
    delete windowWithLegacyMarkers.__TAURI_INTERNALS__
  })

  it('prefers the Tauri v2 global runtime flag', () => {
    ;(globalThis as { isTauri?: unknown }).isTauri = true

    expect(isTauri()).toBe(true)
  })

  it('respects an explicit false runtime flag', () => {
    ;(globalThis as { isTauri?: unknown }).isTauri = false
    windowWithLegacyMarkers.__TAURI__ = {}

    expect(isTauri()).toBe(false)
  })

  it('falls back to the legacy window markers when the runtime flag is absent', () => {
    delete (globalThis as { isTauri?: unknown }).isTauri
    windowWithLegacyMarkers.__TAURI_INTERNALS__ = {}

    expect(isTauri()).toBe(true)
  })
})

describe('mockInvoke production guard', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('throws in a production build instead of silently serving mock data', async () => {
    vi.stubEnv('PROD', true)
    await expect(mockInvoke('list_vault')).rejects.toThrow(/production build/)
  })

  it('serves mock data normally outside a production build', async () => {
    vi.stubEnv('PROD', false)
    await expect(mockInvoke('list_vault')).resolves.toBeDefined()
  })
})
