import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ChatComposerFoot } from './ChatComposerFoot'

describe('ChatComposerFoot', () => {
  it('names the last tool while a turn is running', () => {
    render(<ChatComposerFoot working lastToolName="get_note" />)

    expect(screen.getByTestId('chat-composer-foot')).toHaveTextContent(
      'Working · last tool get_note',
    )
  })

  it('keeps status at 12px', () => {
    render(<ChatComposerFoot working />)

    expect(screen.getByTestId('chat-composer-foot')).toHaveClass('text-[12px]')
  })

  it('does not claim Escape stops a running turn', () => {
    render(<ChatComposerFoot working lastToolName="get_note" />)

    // Escape reaches useAiPanelFocus.ts:58, which calls onClose() whenever focus is
    // anywhere inside the panel -- so in ChatHome it leaves Chat entirely. Nothing
    // stops a turn from the keyboard; onStop is reachable only by clicking Stop.
    const foot = screen.getByTestId('chat-composer-foot')
    expect(foot).not.toHaveTextContent('Esc')
    expect(foot).not.toHaveTextContent('⌘')
  })
})
