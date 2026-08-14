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

  it('shows the stop chord while working and the send chord when idle', () => {
    const { rerender } = render(<ChatComposerFoot working lastToolName="get_note" />)
    expect(screen.getByTestId('chat-composer-foot')).toHaveTextContent('Esc')
    expect(screen.getByTestId('chat-composer-foot')).toHaveTextContent('stop')

    rerender(<ChatComposerFoot />)
    expect(screen.getByTestId('chat-composer-foot')).not.toHaveTextContent('Esc')
    expect(screen.getByTestId('chat-composer-foot')).toHaveTextContent('send')
  })
})
