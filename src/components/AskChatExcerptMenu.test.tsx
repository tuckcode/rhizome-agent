import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AskChatExcerptMenu } from './AskChatExcerptMenu'
import { formatAskChatExcerpt } from './askChatExcerpt'

function selectNodeText(node: HTMLElement) {
  const range = document.createRange()
  range.selectNodeContents(node)
  const selection = window.getSelection()
  selection?.removeAllRanges()
  selection?.addRange(range)
}

describe('formatAskChatExcerpt', () => {
  it('quotes the highlight so Chat can see it in this thread', () => {
    expect(formatAskChatExcerpt('Custom Instructions', 'Keep replies short.')).toBe(
      'Look at this excerpt from “Custom Instructions”:\n\n> Keep replies short.\n\nWhat should I know?',
    )
  })
})

describe('AskChatExcerptMenu', () => {
  it('offers Ask Chat about this when the note has a highlight', () => {
    const onAsk = vi.fn()
    render(
      <AskChatExcerptMenu onAsk={onAsk}>
        <p>Keep replies short.</p>
      </AskChatExcerptMenu>,
    )

    const body = screen.getByText('Keep replies short.')
    selectNodeText(body)
    fireEvent.contextMenu(body)

    fireEvent.click(screen.getByRole('menuitem', { name: 'Ask Chat about this' }))
    expect(onAsk).toHaveBeenCalledWith('Keep replies short.')
  })

  it('copies the highlight from the same menu', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })

    render(
      <AskChatExcerptMenu onAsk={vi.fn()}>
        <p>Keep replies short.</p>
      </AskChatExcerptMenu>,
    )

    const body = screen.getByText('Keep replies short.')
    selectNodeText(body)
    fireEvent.contextMenu(body)
    fireEvent.click(screen.getByRole('menuitem', { name: 'Copy' }))

    await vi.waitFor(() => {
      expect(writeText).toHaveBeenCalledWith('Keep replies short.')
    })
  })

  it('allows the native context menu when nothing is highlighted', () => {
    render(
      <AskChatExcerptMenu onAsk={vi.fn()}>
        <p>Keep replies short.</p>
      </AskChatExcerptMenu>,
    )

    const root = screen.getByText('Keep replies short.').parentElement
    expect(root).toHaveAttribute('data-allow-native-context-menu')
    fireEvent.contextMenu(screen.getByText('Keep replies short.'))
    expect(screen.queryByRole('menuitem', { name: 'Ask Chat about this' })).not.toBeInTheDocument()
  })
})
