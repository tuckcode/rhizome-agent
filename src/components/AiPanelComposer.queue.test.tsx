import { readFileSync } from 'node:fs'
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

  it('keeps queued follow-ups on screen across a rerender', () => {
    const queue = { steering: [] as string[], followUp: ['then summarise'] }
    const { rerender } = renderComposer(queue)

    expect(screen.getByTestId('composer-queued-follow-ups')).toHaveTextContent('then summarise')

    rerender(
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
      />,
    )

    expect(screen.getByTestId('composer-queued-follow-ups')).toHaveTextContent('then summarise')
  })

  it('asks Prime to clear the queue', () => {
    const onClearQueue = vi.fn()
    renderComposer({ steering: [], followUp: ['then summarise'] }, onClearQueue)

    fireEvent.click(screen.getByTestId('composer-queue-clear'))
    expect(onClearQueue).toHaveBeenCalledOnce()
  })

  it('keeps queued text at 12px so the follow-up stays readable', () => {
    renderComposer({ steering: [], followUp: ['then summarise'] })

    const row = screen.getByTestId('composer-queued-follow-up')
    expect(row).toHaveClass('text-[12px]')
    expect(row.querySelector('.text-foreground')).toHaveTextContent('then summarise')
  })

  it('does not speak mutate_queued_message', () => {
    const chrome = readFileSync(`${process.cwd()}/src/components/AiPanelChrome.tsx`, 'utf8')
    const panel = readFileSync(`${process.cwd()}/src/components/AiPanel.tsx`, 'utf8')
    expect(chrome).not.toContain('mutate_queued_message')
    expect(panel).not.toContain('mutate_queued_message')
  })
})
