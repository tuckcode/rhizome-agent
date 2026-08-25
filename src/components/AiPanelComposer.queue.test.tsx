import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AiPanelComposer } from './AiPanelChrome'
import type { PrimeQueue } from '../lib/primeQueue'

function renderComposer(queue?: PrimeQueue, onClearQueue?: () => void) {
  return render(
    <AiPanelComposer
      entries={[]}
      agentLabel="Prime"
      agentReadiness="ready"
      input=""
      inputRef={{ current: null }}
      isActive
      onChange={vi.fn()}
      onSend={vi.fn()}
      onSteer={vi.fn()}
      onStop={vi.fn()}
      queue={queue}
      onClearQueue={onClearQueue}
    />,
  )
}

describe('queued follow-ups in the composer', () => {
  it('lists steering then follow-ups in the order they will run', () => {
    renderComposer({
      steering: ['focus on error handling'],
      followUp: ['then summarise'],
    })

    const items = screen.getAllByRole('listitem').map((item) => item.textContent)
    expect(items).toEqual(['Steer · focus on error handling', 'After · then summarise'])
  })

  it('renders nothing when the queue is empty', () => {
    renderComposer({ steering: [], followUp: [] })

    expect(screen.queryByTestId('composer-queued-follow-ups')).toBeNull()
  })

  it('renders nothing when the surface does not queue at all', () => {
    renderComposer(undefined)

    expect(screen.queryByTestId('composer-queued-follow-ups')).toBeNull()
  })

  it('asks Prime to clear the queue', () => {
    const onClearQueue = vi.fn()
    renderComposer({ steering: [], followUp: ['then summarise'] }, onClearQueue)

    fireEvent.click(screen.getByTestId('composer-queue-clear'))
    expect(onClearQueue).toHaveBeenCalledOnce()
  })
})
