import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  PRIME_DAEMON_MUTATE_QUEUED_MESSAGE,
  mutatePrimeQueuedMessage,
  notePrimeQueuePayload,
  primeQueueLane,
  primeQueueMutationAvailable,
  requestPrimeQueueRefresh,
  usePrimeQueue,
} from './usePrimeQueue'

const callHost = vi.hoisted(() => vi.fn())

vi.mock('../lib/callHost', () => ({
  callHost,
}))

vi.mock('../lib/productAnalytics', () => ({
  trackPrimeQueueCleared: vi.fn(),
}))

describe('mutate one queued line', () => {
  beforeEach(() => {
    callHost.mockReset()
    notePrimeQueuePayload({})
  })

  it('maps steer to steering and sends the last preview', async () => {
    callHost.mockResolvedValueOnce({ status: 'applied' })

    const status = await mutatePrimeQueuedMessage({
      lane: 'steer',
      index: 0,
      expectedText: 'focus on error handling',
      mutation: { type: 'delete' },
    })

    expect(status).toBe('applied')
    expect(primeQueueLane('steer')).toBe('steering')
    expect(primeQueueLane('followUp')).toBe('followUp')
    expect(PRIME_DAEMON_MUTATE_QUEUED_MESSAGE).toBe('mutate_queued_message')
    expect(callHost).toHaveBeenCalledWith('mutate_prime_queued_message', {
      lane: 'steering',
      index: 0,
      expectedText: 'focus on error handling',
      mutation: { type: 'delete' },
    })
  })

  it('returns rejected so the caller can refetch, and invalid so the draft can stay', async () => {
    callHost.mockResolvedValueOnce({ status: 'rejected' })
    await expect(mutatePrimeQueuedMessage({
      lane: 'followUp',
      index: 1,
      expectedText: 'then summarise',
      mutation: { type: 'replace', text: 'ship it', },
    })).resolves.toBe('rejected')

    callHost.mockResolvedValueOnce({ status: 'invalid' })
    await expect(mutatePrimeQueuedMessage({
      lane: 'followUp',
      index: 1,
      expectedText: 'then summarise',
      mutation: { type: 'replace', text: 'nope' },
    })).resolves.toBe('invalid')
  })

  it('records canMutate from get_queue and refetches when asked', async () => {
    callHost.mockResolvedValue({ steering: ['focus'], followUp: [], canMutate: true })
    const { result } = renderHook(() => usePrimeQueue(true))

    await waitFor(() => {
      expect(primeQueueMutationAvailable()).toBe(true)
    })
    expect(result.current.queue.steering).toEqual(['focus'])

    callHost.mockClear()
    requestPrimeQueueRefresh()
    await waitFor(() => {
      expect(callHost).toHaveBeenCalledWith('get_prime_session_queue')
    })
  })
})
