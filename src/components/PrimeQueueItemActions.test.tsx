import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PrimeQueueItemActions } from './PrimeQueueItemActions'
import { notePrimeQueuePayload } from '../hooks/usePrimeQueue'
import type { PrimeQueueItem } from '../lib/primeQueue'

const callHost = vi.hoisted(() => vi.fn())

vi.mock('../lib/callHost', () => ({
  callHost,
}))

const steer: PrimeQueueItem = {
  lane: 'steer',
  index: 0,
  text: 'focus on error handling',
}

describe('PrimeQueueItemActions', () => {
  beforeEach(() => {
    callHost.mockReset()
    notePrimeQueuePayload({})
  })

  it('hides rewrite and delete when the daemon cannot mutate the queue', () => {
    render(<PrimeQueueItemActions item={steer} />)

    expect(screen.queryByRole('button', { name: 'Rewrite' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull()
  })

  it('deletes one steer line using the preview as expected text', async () => {
    notePrimeQueuePayload({ canMutate: true })
    callHost.mockResolvedValue({ status: 'applied' })
    render(<PrimeQueueItemActions item={steer} />)

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))

    await waitFor(() => {
      expect(callHost).toHaveBeenCalledWith('mutate_prime_queued_message', {
        lane: 'steering',
        index: 0,
        expectedText: 'focus on error handling',
        mutation: { type: 'delete' },
      })
    })
  })

  it('keeps the rewrite draft when the daemon says the edit is invalid', async () => {
    notePrimeQueuePayload({ canMutate: true })
    callHost.mockResolvedValue({ status: 'invalid' })
    render(<PrimeQueueItemActions item={steer} />)

    fireEvent.click(screen.getByRole('button', { name: 'Rewrite' }))
    const input = screen.getByRole('textbox', { name: 'Rewrite queued line' })
    fireEvent.change(input, { target: { value: 'not a command' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(screen.getByText('That edit is not a valid queued command.')).toBeTruthy()
    })
    expect(screen.getByRole('textbox', { name: 'Rewrite queued line' })).toHaveValue('not a command')
    expect(callHost).toHaveBeenCalledWith('mutate_prime_queued_message', {
      lane: 'steering',
      index: 0,
      expectedText: 'focus on error handling',
      mutation: { type: 'replace', text: 'not a command', lane: 'steering' },
    })
  })

  it('closes the draft when the daemon rejects the edit', async () => {
    notePrimeQueuePayload({ canMutate: true })
    callHost.mockResolvedValue({ status: 'rejected' })
    render(<PrimeQueueItemActions item={steer} />)

    fireEvent.click(screen.getByRole('button', { name: 'Rewrite' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Rewrite' })).toBeTruthy()
    })
    expect(screen.queryByRole('textbox', { name: 'Rewrite queued line' })).toBeNull()
  })
})
