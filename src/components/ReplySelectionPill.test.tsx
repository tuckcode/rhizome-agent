import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ReplySelectionPill } from './ReplySelectionPill'

function selectNodeText(node: HTMLElement) {
  const range = document.createRange()
  range.selectNodeContents(node)
  const selection = window.getSelection()
  selection?.removeAllRanges()
  selection?.addRange(range)
}

describe('ReplySelectionPill', () => {
  it('shows Add to Chat above a highlight and passes the text', () => {
    const onAdd = vi.fn()
    render(
      <ReplySelectionPill onAdd={onAdd}>
        <p>The path is blocked.</p>
      </ReplySelectionPill>,
    )

    const body = screen.getByText('The path is blocked.')
    selectNodeText(body)
    fireEvent.mouseUp(body)

    fireEvent.click(screen.getByRole('button', { name: 'Add to Chat' }))
    expect(onAdd).toHaveBeenCalledWith('The path is blocked.')
    expect(screen.queryByRole('button', { name: 'Add to Chat' })).not.toBeInTheDocument()
  })

  it('stays hidden when nothing is highlighted', () => {
    render(
      <ReplySelectionPill onAdd={vi.fn()}>
        <p>The path is blocked.</p>
      </ReplySelectionPill>,
    )

    fireEvent.mouseUp(screen.getByText('The path is blocked.'))
    expect(screen.queryByRole('button', { name: 'Add to Chat' })).not.toBeInTheDocument()
  })
})
