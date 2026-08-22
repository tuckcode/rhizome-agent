import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AiPanelComposer } from './AiPanelChrome'

function renderComposer(queuedFollowUps?: string[]) {
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
      queuedFollowUps={queuedFollowUps}
    />,
  )
}

describe('queued follow-ups in the composer', () => {
  it('lists queued messages in the order they will run', () => {
    renderComposer(['check the tests', 'then summarise'])

    const items = screen.getAllByRole('listitem').map((item) => item.textContent)
    expect(items).toEqual(['1check the tests', '2then summarise'])
  })

  it('renders nothing when the queue is empty', () => {
    renderComposer([])

    expect(screen.queryByTestId('composer-queued-follow-ups')).toBeNull()
  })

  it('renders nothing when the surface does not queue at all', () => {
    renderComposer(undefined)

    expect(screen.queryByTestId('composer-queued-follow-ups')).toBeNull()
  })
})
