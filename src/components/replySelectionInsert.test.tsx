import { useState } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AiMessage } from './AiMessage'
import { WikilinkChatInput } from './WikilinkChatInput'

function Chat({ onSend }: { onSend: (text: string) => void }) {
  const [value, setValue] = useState('Hello world')
  return (
    <>
      <AiMessage userMessage="Ask" actions={[]} response="The path is blocked." messageId="msg-1" />
      <WikilinkChatInput entries={[]} value={value} onChange={setValue} onSend={onSend} />
    </>
  )
}

function placeCaret(editor: HTMLElement, offset: number) {
  const text = editor.firstChild
  if (!text) throw new Error('composer has no text')
  const range = document.createRange()
  range.setStart(text, offset)
  range.collapse(true)
  const selection = window.getSelection()
  selection?.removeAllRanges()
  selection?.addRange(range)
  fireEvent.mouseUp(editor)
}

describe('Add to Chat at the caret', () => {
  it('puts the highlighted reply at the caret and does not send', () => {
    const onSend = vi.fn()
    render(<Chat onSend={onSend} />)
    placeCaret(screen.getByTestId('agent-input'), 5)

    const body = screen.getByText('The path is blocked.')
    const range = document.createRange()
    range.selectNodeContents(body)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
    fireEvent.mouseUp(body)

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Add to Chat' }))
    })

    const editor = screen.getByTestId('agent-input')
    const quote = screen.getByTestId('composer-reply-quote')
    expect(quote).toHaveAttribute('data-message-id', 'msg-1')
    expect(quote).toHaveStyle({ color: 'var(--link-color)' })
    expect(quote).toHaveTextContent('The path is blocked.')
    expect(editor.childNodes[0].textContent).toBe('Hello')
    expect(editor.textContent?.endsWith(' world')).toBe(true)
    const reply = screen.getByTestId('ai-response-block')
    reply.scrollIntoView = vi.fn()
    fireEvent.click(quote)
    expect(reply.scrollIntoView).toHaveBeenCalled()
    expect(onSend).not.toHaveBeenCalled()
  })
})
