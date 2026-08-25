import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SessionBranchBand } from './SessionBranchBand'
import type { PrimeSessionTree } from '../lib/primeSessionTree'

const forked: PrimeSessionTree = {
  leafId: 'rust',
  nodes: [
    { id: 'u1', kind: 'user', title: 'how should we store this' },
    { id: 'a1', parentId: 'u1', kind: 'assistant', title: 'options' },
    { id: 'ts', parentId: 'a1', kind: 'user', title: 'stay on typescript' },
    { id: 'rust', parentId: 'a1', kind: 'user', title: 'try rust rewrite' },
  ],
}

describe('SessionBranchBand', () => {
  it('renders nothing on a linear conversation', () => {
    render(
      <SessionBranchBand
        tree={{
          leafId: 'a1',
          nodes: [
            { id: 'u1', kind: 'user', title: 'hello' },
            { id: 'a1', parentId: 'u1', kind: 'assistant', title: 'hi' },
          ],
        }}
        onSelect={vi.fn()}
      />,
    )
    expect(screen.queryByTestId('session-branch-band')).not.toBeInTheDocument()
  })

  it('names this conversation, not the sessions list, and continues from a sibling', () => {
    const onSelect = vi.fn()
    render(<SessionBranchBand tree={forked} onSelect={onSelect} />)

    expect(screen.getByTestId('session-branch-band')).toHaveTextContent('in this conversation')
    expect(screen.getByText(/try rust rewrite/)).toHaveTextContent('current')
    fireEvent.click(screen.getByTestId('session-branch-select'))
    expect(onSelect).toHaveBeenCalledWith('ts')
  })
})
