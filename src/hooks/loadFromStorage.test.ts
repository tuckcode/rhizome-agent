import { beforeEach, describe, expect, it, vi } from 'vitest'
import { loadFromStorage } from './useVaultConfig'

const VAULT = '/Users/x/Rhizome Vault'

describe('loadFromStorage', () => {
  let store: Record<string, string>

  beforeEach(() => {
    store = {}
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => store[key] ?? null),
      setItem: vi.fn((key: string, val: string) => { store[key] = val }),
    })
  })

  it('reads from the current rhizome:vault-config: key when present', () => {
    store[`rhizome:vault-config:${VAULT}`] = JSON.stringify({ zoom: 1.5 })

    expect(loadFromStorage(VAULT).zoom).toBe(1.5)
  })

  /**
   * This key was never migrated even once — it stayed on "laputa" through
   * the laputa->tolaria rename and would have carried straight through the
   * tolaria->rhizome one too without this fallback (ADR-0162).
   */
  it('falls back to the never-migrated laputa:vault-config: key', () => {
    store[`laputa:vault-config:${VAULT}`] = JSON.stringify({ zoom: 1.25 })

    expect(loadFromStorage(VAULT).zoom).toBe(1.25)
  })

  it('prefers the current key over the legacy one when both exist', () => {
    store[`rhizome:vault-config:${VAULT}`] = JSON.stringify({ zoom: 1.5 })
    store[`laputa:vault-config:${VAULT}`] = JSON.stringify({ zoom: 1.25 })

    expect(loadFromStorage(VAULT).zoom).toBe(1.5)
  })

  it('returns defaults when neither key has a value', () => {
    expect(loadFromStorage(VAULT).zoom).toBeNull()
  })

  it('returns defaults when the stored value is not valid JSON', () => {
    store[`rhizome:vault-config:${VAULT}`] = 'not json'

    expect(loadFromStorage(VAULT).zoom).toBeNull()
  })
})
