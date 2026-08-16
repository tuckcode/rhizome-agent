import { renderHook, act } from '@testing-library/react'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { usePrimeUpdate } from './usePrimeUpdate'

vi.mock('../mock-tauri', () => ({
  isTauri: vi.fn(() => false),
}))

const mockOpenExternalUrl = vi.fn()
vi.mock('../utils/url', () => ({
  openExternalUrl: (...args: unknown[]) => mockOpenExternalUrl(...args),
}))

const mockInvoke = vi.fn()

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}))

import { isTauri } from '../mock-tauri'

function makeRelease(overrides: Partial<{ version: string; notes: string; url: string }> = {}) {
  return {
    version: '0.7.2',
    notes: '- Fixed a bug',
    url: 'https://github.com/PrimeIntellect-ai/prime-agent/releases/tag/v0.7.2',
    ...overrides,
  }
}

beforeEach(() => {
  vi.mocked(isTauri).mockReturnValue(true)
  mockInvoke.mockReset()
  mockOpenExternalUrl.mockReset()
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('usePrimeUpdate', () => {
  it('starts idle and does not check when Prime has no known version', async () => {
    const { result } = renderHook(() => usePrimeUpdate(null))

    expect(result.current.status).toEqual({ state: 'idle' })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000)
    })

    expect(mockInvoke).not.toHaveBeenCalled()
    expect(result.current.status).toEqual({ state: 'idle' })
  })

  it('does not check outside Tauri (browser/mocked environment)', async () => {
    vi.mocked(isTauri).mockReturnValue(false)
    renderHook(() => usePrimeUpdate('0.7.0'))

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000)
    })

    expect(mockInvoke).not.toHaveBeenCalled()
  })

  it('auto-checks 3s after mount once a Prime version is known, and reports an available release', async () => {
    mockInvoke.mockResolvedValue(makeRelease())

    const { result } = renderHook(() => usePrimeUpdate('0.7.0'))

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000)
    })

    expect(mockInvoke).toHaveBeenCalledWith('check_prime_update', { installedVersion: '0.7.0' })
    expect(result.current.status).toEqual({ state: 'available', ...makeRelease() })
  })

  it('reports idle when the backend finds no newer release', async () => {
    mockInvoke.mockResolvedValue(null)

    const { result } = renderHook(() => usePrimeUpdate('0.7.2'))

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000)
    })

    expect(result.current.status).toEqual({ state: 'idle' })
  })

  it('reports an error state when the check fails, without crashing', async () => {
    mockInvoke.mockRejectedValue(new Error('network down'))

    const { result } = renderHook(() => usePrimeUpdate('0.7.0'))

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000)
    })

    expect(result.current.status).toEqual({ state: 'error' })
  })

  it('a manual checkForPrimeUpdate call flips through checking to available', async () => {
    let resolveInvoke: (value: unknown) => void = () => {}
    mockInvoke.mockReturnValue(new Promise((resolve) => { resolveInvoke = resolve }))

    const { result } = renderHook(() => usePrimeUpdate('0.7.0'))

    // Let the auto-check timer fire and land in 'checking'.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000)
    })
    expect(result.current.status).toEqual({ state: 'checking' })

    await act(async () => {
      resolveInvoke(makeRelease())
      await Promise.resolve()
    })

    expect(result.current.status).toEqual({ state: 'available', ...makeRelease() })
  })

  it('openPrimeReleasePage opens the real release URL once an update is available', async () => {
    mockInvoke.mockResolvedValue(makeRelease({ url: 'https://example.com/release' }))

    const { result } = renderHook(() => usePrimeUpdate('0.7.0'))

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000)
    })

    act(() => {
      result.current.actions.openPrimeReleasePage()
    })

    expect(mockOpenExternalUrl).toHaveBeenCalledWith('https://example.com/release')
  })

  it('openPrimeReleasePage does nothing when there is no known release', () => {
    const { result } = renderHook(() => usePrimeUpdate(null))

    act(() => {
      result.current.actions.openPrimeReleasePage()
    })

    expect(mockOpenExternalUrl).not.toHaveBeenCalled()
  })
})
