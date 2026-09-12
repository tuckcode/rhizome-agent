import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const invoked = vi.hoisted(() => ({
  calls: [] as string[],
}))

vi.mock('../lib/callHost', () => ({
  callHost: (cmd: string) => {
    invoked.calls.push(cmd)
    return Promise.resolve({ nodes: [] })
  },
}))

import { usePrimeSessionTree } from './usePrimeSessionTree'

describe('usePrimeSessionTree', () => {
  beforeEach(() => {
    invoked.calls = []
  })

  it('reads the tree once per session, not on a background timer', async () => {
    const interval = vi.spyOn(window, 'setInterval')
    renderHook(() => usePrimeSessionTree(true, 'sess-1'))

    await waitFor(() => {
      expect(invoked.calls).toEqual(['get_prime_session_tree'])
    })
    expect(interval.mock.calls.filter(([, delay]) => delay === 4_000)).toHaveLength(0)
    interval.mockRestore()
  })
})
