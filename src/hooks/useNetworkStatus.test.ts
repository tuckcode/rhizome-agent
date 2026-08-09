import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useNetworkStatus } from './useNetworkStatus'

describe('useNetworkStatus', () => {
  let online = true

  beforeEach(() => {
    online = true
    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      get: () => online,
    })
  })

  it('uses navigator.onLine for the initial state', () => {
    online = false

    const { result } = renderHook(() => useNetworkStatus())

    expect(result.current.isOffline).toBe(true)
  })

  it('updates when online and offline events fire', () => {
    const { result } = renderHook(() => useNetworkStatus())

    expect(result.current.isOffline).toBe(false)

    act(() => {
      online = false
      window.dispatchEvent(new Event('offline'))
    })

    expect(result.current.isOffline).toBe(true)

    act(() => {
      online = true
      window.dispatchEvent(new Event('online'))
    })

    expect(result.current.isOffline).toBe(false)
  })
})
