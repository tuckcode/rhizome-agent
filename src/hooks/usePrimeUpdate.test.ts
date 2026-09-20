import { renderHook, act } from '@testing-library/react'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { usePrimeUpdate } from './usePrimeUpdate'

const mockTauriInvoke = vi.fn()
vi.mock('../mock-tauri', () => ({
  isTauri: vi.fn(() => false),
  mockInvoke: (...args: unknown[]) => mockTauriInvoke(...args),
}))

const mockOpenExternalUrl = vi.fn()
vi.mock('../utils/url', () => ({
  openExternalUrl: (...args: unknown[]) => mockOpenExternalUrl(...args),
}))

const mockInvoke = vi.fn()

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}))

const {
  trackEngineUpdateOffered,
  trackEngineUpdateAccepted,
  trackEngineUpdateFailed,
} = vi.hoisted(() => ({
  trackEngineUpdateOffered: vi.fn(),
  trackEngineUpdateAccepted: vi.fn(),
  trackEngineUpdateFailed: vi.fn(),
}))
vi.mock('../lib/productAnalytics', () => ({
  trackEngineUpdateOffered,
  trackEngineUpdateAccepted,
  trackEngineUpdateFailed,
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

function makeApplyResult(
  overrides: Partial<{
    previousVersion: string
    installedVersion: string
    method: 'npm' | 'homebrew' | 'mise' | 'asdf' | 'unknown'
  }> = {},
) {
  return {
    previousVersion: '0.7.0',
    installedVersion: '0.7.2',
    method: 'npm' as const,
    ...overrides,
  }
}

beforeEach(() => {
  vi.mocked(isTauri).mockReturnValue(true)
  mockInvoke.mockReset()
  mockTauriInvoke.mockReset()
  mockOpenExternalUrl.mockReset()
  trackEngineUpdateOffered.mockReset()
  trackEngineUpdateAccepted.mockReset()
  trackEngineUpdateFailed.mockReset()
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

  it('still checks in the browser so mock-tauri can offer an update', async () => {
    vi.mocked(isTauri).mockReturnValue(false)
    mockTauriInvoke.mockResolvedValue({
      version: '0.9.4',
      notes: '- Mock Chat engine release so Update now can be clicked in the browser.',
      url: 'https://github.com/PrimeIntellect-ai/prime-agent/releases/tag/v0.9.4',
    })
    const { result } = renderHook(() => usePrimeUpdate('0.9.3'))

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3100)
    })

    expect(mockInvoke).not.toHaveBeenCalled()
    expect(mockTauriInvoke).toHaveBeenCalledWith('check_prime_update', {
      installedVersion: '0.9.3',
    })
    expect(result.current.status).toMatchObject({
      state: 'available',
      version: '0.9.4',
    })
  })

  it('auto-checks 3s after mount once a Prime version is known, and reports an available release', async () => {
    mockInvoke.mockResolvedValue(makeRelease())

    const { result } = renderHook(() => usePrimeUpdate('0.7.0'))

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000)
    })

    expect(mockInvoke).toHaveBeenCalledWith('check_prime_update', { installedVersion: '0.7.0' })
    expect(result.current.status).toEqual({ state: 'available', ...makeRelease() })
    expect(trackEngineUpdateOffered).toHaveBeenCalledWith('0.7.2')
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

  it('applyEngineUpdate invokes apply_prime_update with expectedVersion and chatBusy false', async () => {
    mockInvoke.mockImplementation((command: string) => {
      if (command === 'check_prime_update') return Promise.resolve(makeRelease())
      if (command === 'apply_prime_update') return Promise.resolve(makeApplyResult())
      return Promise.reject(new Error(`unexpected command ${command}`))
    })

    const { result } = renderHook(() => usePrimeUpdate('0.7.0', false))

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000)
    })

    await act(async () => {
      await result.current.actions.applyEngineUpdate()
    })

    expect(mockInvoke).toHaveBeenCalledWith('apply_prime_update', {
      expectedVersion: '0.7.2',
      chatBusy: false,
    })
    expect(mockOpenExternalUrl).not.toHaveBeenCalled()
    expect(trackEngineUpdateAccepted).toHaveBeenCalledWith('0.7.2')
    expect(result.current.status).toMatchObject({
      state: 'applied',
      installedVersion: '0.7.2',
      previousVersion: '0.7.0',
      method: 'npm',
    })
  })

  it('applyEngineUpdate still invokes when chatBusy is true so the host can refuse', async () => {
    mockInvoke.mockImplementation((command: string) => {
      if (command === 'check_prime_update') return Promise.resolve(makeRelease())
      if (command === 'apply_prime_update') {
        return Promise.reject(new Error('Chat is still answering. Wait until the reply finishes, then update.'))
      }
      return Promise.reject(new Error(`unexpected command ${command}`))
    })

    const { result } = renderHook(() => usePrimeUpdate('0.7.0', true))

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000)
    })

    await act(async () => {
      await result.current.actions.applyEngineUpdate()
    })

    expect(mockInvoke).toHaveBeenCalledWith('apply_prime_update', {
      expectedVersion: '0.7.2',
      chatBusy: true,
    })
    expect(result.current.status).toMatchObject({
      state: 'failed',
      reason: 'busy',
      message: 'Chat is still answering. Wait until the reply finishes, then update.',
    })
    expect(trackEngineUpdateFailed).toHaveBeenCalledWith('busy')
  })

  it('moves through applying while apply_prime_update is in flight', async () => {
    let resolveApply: (value: unknown) => void = () => {}
    mockInvoke.mockImplementation((command: string) => {
      if (command === 'check_prime_update') return Promise.resolve(makeRelease())
      if (command === 'apply_prime_update') {
        return new Promise((resolve) => {
          resolveApply = resolve
        })
      }
      return Promise.reject(new Error(`unexpected command ${command}`))
    })

    const { result } = renderHook(() => usePrimeUpdate('0.7.0', false))

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000)
    })

    let applyPromise: Promise<void> = Promise.resolve()
    act(() => {
      applyPromise = result.current.actions.applyEngineUpdate()
    })

    expect(result.current.status.state).toBe('applying')

    await act(async () => {
      resolveApply(makeApplyResult())
      await applyPromise
    })

    expect(result.current.status.state).toBe('applied')
  })

  it('surfaces Chat-engine wording when apply fails, not Prime as the product name', async () => {
    mockInvoke.mockImplementation((command: string) => {
      if (command === 'check_prime_update') return Promise.resolve(makeRelease())
      if (command === 'apply_prime_update') {
        return Promise.reject(new Error('Could not install Prime 0.7.2'))
      }
      return Promise.reject(new Error(`unexpected command ${command}`))
    })

    const { result } = renderHook(() => usePrimeUpdate('0.7.0', false))

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000)
    })

    await act(async () => {
      await result.current.actions.applyEngineUpdate()
    })

    expect(result.current.status.state).toBe('failed')
    if (result.current.status.state === 'failed') {
      expect(result.current.status.message).toContain('Chat engine')
      expect(result.current.status.message).not.toMatch(/\bPrime 0\.7\.2\b/)
      expect(result.current.status.reason).toBe('failed')
    }
    expect(trackEngineUpdateFailed).toHaveBeenCalledWith('failed')
  })

  it('does not apply on the auto-check path', async () => {
    mockInvoke.mockResolvedValue(makeRelease())

    renderHook(() => usePrimeUpdate('0.7.0', false))

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000)
    })

    expect(mockInvoke).toHaveBeenCalledWith('check_prime_update', { installedVersion: '0.7.0' })
    expect(mockInvoke).not.toHaveBeenCalledWith('apply_prime_update', expect.anything())
    expect(trackEngineUpdateAccepted).not.toHaveBeenCalled()
  })

  it('offers the release page when the host uses the mise/asdf/unknown failure copy', async () => {
    mockInvoke.mockImplementation((command: string) => {
      if (command === 'check_prime_update') return Promise.resolve(makeRelease())
      if (command === 'apply_prime_update') {
        return Promise.reject(
          new Error(
            'Could not update the Chat engine. Try again, or update it from the release page.',
          ),
        )
      }
      return Promise.reject(new Error(`unexpected command ${command}`))
    })

    const { result } = renderHook(() => usePrimeUpdate('0.7.0', false))

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000)
    })

    await act(async () => {
      await result.current.actions.applyEngineUpdate()
    })

    expect(result.current.status).toMatchObject({
      state: 'failed',
      reason: 'unknown',
      method: 'unknown',
      message: 'Could not update the Chat engine. Try again, or update it from the release page.',
    })
  })
})
