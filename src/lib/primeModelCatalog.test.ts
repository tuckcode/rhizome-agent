import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  loadPrimeModelCatalog,
  onPrimeModelCatalogReset,
  peekPrimeModelCatalog,
  resetPrimeModelCatalog,
} from './primeModelCatalog'

const invoked = vi.hoisted(() => ({
  calls: 0,
  fail: '',
  hold: null as Promise<void> | null,
  models: [{ id: 'grok-4.5', name: 'Grok 4.5', provider: 'xai' }],
}))

vi.mock('./callHost', () => ({
  callHost: (cmd: string) => {
    if (cmd !== 'get_available_prime_models') return Promise.resolve(null)
    invoked.calls += 1
    const done = invoked.hold ?? Promise.resolve()
    return done.then(() => {
      if (invoked.fail) return Promise.reject(new Error(invoked.fail))
      return invoked.models
    })
  },
}))

afterEach(() => {
  resetPrimeModelCatalog()
  invoked.calls = 0
  invoked.fail = ''
  invoked.hold = null
})

describe('loadPrimeModelCatalog', () => {
  it('asks Prime once and remembers the answer', async () => {
    const first = await loadPrimeModelCatalog()
    const second = await loadPrimeModelCatalog()

    expect(first).toEqual(invoked.models)
    expect(second).toBe(first)
    expect(invoked.calls).toBe(1)
    expect(peekPrimeModelCatalog()).toEqual(invoked.models)
  })

  it('does not remember a host that was not running yet', async () => {
    invoked.fail = 'Prime session host is not running'
    await expect(loadPrimeModelCatalog()).rejects.toThrow('Prime session host is not running')
    expect(peekPrimeModelCatalog()).toBeNull()

    invoked.fail = ''
    await expect(loadPrimeModelCatalog()).resolves.toEqual(invoked.models)
    expect(invoked.calls).toBe(2)
  })

  it('does not keep a fetch that finished after reset', async () => {
    let release!: () => void
    invoked.hold = new Promise((resolve) => {
      release = resolve
    })
    const pending = loadPrimeModelCatalog()
    resetPrimeModelCatalog()
    invoked.hold = null
    release()
    await pending
    expect(peekPrimeModelCatalog()).toBeNull()

    await expect(loadPrimeModelCatalog()).resolves.toEqual(invoked.models)
    expect(invoked.calls).toBe(2)
  })

  it('tells listeners the catalog was cleared', () => {
    const listener = vi.fn()
    const stop = onPrimeModelCatalogReset(listener)
    resetPrimeModelCatalog()
    expect(listener).toHaveBeenCalledTimes(1)
    stop()
    resetPrimeModelCatalog()
    expect(listener).toHaveBeenCalledTimes(1)
  })
})
