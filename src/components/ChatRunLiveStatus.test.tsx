import { act, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ChatRunLiveStatus } from './ChatRunLiveStatus'

async function nextFrame() {
  await act(async () => {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve())
    })
  })
}

describe('ChatRunLiveStatus repeated announcements', () => {
  it('clears then restores an identical Response complete so VoiceOver re-reads it', async () => {
    const firstTurn = [{ userMessage: 'hi', response: 'hello' }]
    const secondTurn = [
      ...firstTurn,
      { userMessage: 'again', response: 'hello again' },
    ]

    const { rerender } = render(
      <ChatRunLiveStatus messages={firstTurn} isActive />,
    )
    rerender(<ChatRunLiveStatus messages={firstTurn} isActive={false} />)
    await nextFrame()
    await nextFrame()
    expect(screen.getByTestId('chat-run-live-status')).toHaveTextContent('Response complete')

    rerender(<ChatRunLiveStatus messages={secondTurn} isActive />)
    rerender(<ChatRunLiveStatus messages={secondTurn} isActive={false} />)
    await nextFrame()
    expect(screen.getByTestId('chat-run-live-status')).toBeEmptyDOMElement()

    await nextFrame()
    expect(screen.getByTestId('chat-run-live-status')).toHaveTextContent('Response complete')
  })
})
