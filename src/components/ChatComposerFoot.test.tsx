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

  it('says idle when no turn is running', () => {
    render(<ChatComposerFoot />)

    expect(screen.getByTestId('chat-composer-foot')).toHaveTextContent('Idle · ready')
  })

  it('advertises the key that actually sends, not a modifier chord', () => {
    render(<ChatComposerFoot />)

    // handleSubmitKey sends on plain Enter without Shift (inlineWikilinkKeydown.ts:105).
    // Advertising a Cmd chord made users type multi-line prompts that sent themselves
    // on the first newline.
    const foot = screen.getByTestId('chat-composer-foot')
    expect(foot).toHaveTextContent('↵')
    expect(foot).toHaveTextContent('send')
    expect(foot).toHaveTextContent('newline')
    expect(foot).not.toHaveTextContent('⌘')
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
