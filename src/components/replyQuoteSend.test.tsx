import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { replyQuoteToken } from '../lib/replyQuote'
import { AiPanelComposer } from './AiPanelChrome'

describe('sending a reply quote', () => {
  it('sends the quoted words and the reply id', () => {
    const onSend = vi.fn()
    const token = replyQuoteToken({ messageId: 'msg-1', text: 'The path is blocked.' })
    render(
      <AiPanelComposer
        agentLabel="Prime Agent"
        agentReadiness="ready"
        entries={[]}
        input={`See ${token} please`}
        inputRef={{ current: null }}
        isActive={false}
        locale="en"
        onChange={vi.fn()}
        onSend={onSend}
        onStop={vi.fn()}
      />,
    )

    expect(screen.getByTestId('composer-reply-quote')).toHaveAttribute('data-message-id', 'msg-1')
    fireEvent.click(screen.getByTestId('agent-send'))
    expect(onSend).toHaveBeenCalledWith(
      'See “The path is blocked.” (reply: msg-1) please',
      [],
    )
  })
})
