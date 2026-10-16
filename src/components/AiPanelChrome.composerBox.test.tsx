import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AiPanelComposer } from './AiPanelChrome'

/**
 * knispo's collapsed composer was taller than the 30px send control: extra
 * empty space above the button, and more padding on top than on the right
 * or bottom. That is not a reserved deck row (the foot sits under the box)
 * and not a textarea `rows` value (the editor is contenteditable).
 *
 * The leftover height is `min-h-[34px] py-[8px]` on the shared wikilink
 * field. Compact overrides used to apply only when Prime banners set
 * `hasControls`, so native chat kept the taller field. The outer box also
 * used `px-1.5 py-0.5` — unequal padding.
 */

function renderComposer(input = '') {
  return render(
    <AiPanelComposer
      entries={[]}
      agentLabel="Claude"
      agentReadiness="ready"
      input={input}
      inputRef={{ current: null }}
      isActive={false}
      onChange={vi.fn()}
      onSend={vi.fn()}
      onStop={vi.fn()}
    />,
  )
}

describe('AiPanelComposer collapsed box', () => {
  it('hugs the send button with equal padding when the draft is one line', () => {
    renderComposer('')

    const box = screen.getByTestId('chat-composer-box')
    const editor = screen.getByTestId('agent-input')
    const send = screen.getByTestId('agent-send')

    expect(box).toHaveAttribute('data-multiline', 'false')
    expect(box).toContainElement(send)
    expect(box.className.split(/\s+/)).toEqual(
      expect.arrayContaining(['items-center', 'p-1']),
    )
    expect(box.className).not.toMatch(/px-1\.5/)
    expect(box.className).not.toMatch(/py-0\.5/)

    expect(editor.className).toMatch(/min-h-\[30px\]/)
    expect(editor.className).not.toMatch(/min-h-\[34px\]/)
    expect(editor.className).toMatch(/py-1/)
    expect(editor.className).not.toMatch(/py-\[8px\]/)
    expect(editor.className).toMatch(/max-h-\[120px\]/)
  })

  it('still grows with multi-line text instead of staying a single row', () => {
    renderComposer('first line\nsecond line\nthird line')

    const box = screen.getByTestId('chat-composer-box')
    const editor = screen.getByTestId('agent-input')

    expect(box).toHaveAttribute('data-multiline', 'true')
    expect(box).toContainElement(screen.getByTestId('agent-send'))
    expect(editor).toHaveTextContent('first line')
    expect(editor).toHaveTextContent('third line')
    expect(editor.className).toMatch(/max-h-\[120px\]/)
    expect(editor.className).toMatch(/min-h-\[30px\]/)
  })

  it('does not keep the compact hug behind Prime banners', () => {
    render(
      <AiPanelComposer
        entries={[]}
        agentLabel="Prime"
        agentReadiness="ready"
        input=""
        inputRef={{ current: null }}
        isActive={false}
        controls={<div data-testid="prime-banner">banner</div>}
        onChange={vi.fn()}
        onSend={vi.fn()}
        onStop={vi.fn()}
      />,
    )

    expect(screen.getByTestId('prime-banner')).toBeInTheDocument()
    const box = screen.getByTestId('chat-composer-box')
    expect(box).toHaveClass('p-1')
    expect(screen.getByTestId('agent-input').className).toMatch(/min-h-\[30px\]/)
  })
})
