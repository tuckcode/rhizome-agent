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

  it('keeps a pending Response complete when the turn re-renders between frames', async () => {
    const turn = [{ response: 'hello' }]
    const { rerender } = render(
      <ChatRunLiveStatus messages={turn} isActive />,
    )
    rerender(<ChatRunLiveStatus messages={turn} isActive={false} />)
    rerender(<ChatRunLiveStatus messages={[{ response: 'hello' }]} isActive={false} />)
    await nextFrame()
    await nextFrame()
    expect(screen.getByTestId('chat-run-live-status')).toHaveTextContent('Response complete')
  })

  it('keeps Running get_note when a streamed chunk arrives before the frames fire', async () => {
    const { rerender } = render(
      <ChatRunLiveStatus messages={[{ response: '' }]} isActive />,
    )
    rerender(
      <ChatRunLiveStatus
        messages={[{
          response: '',
          actions: [{ tool: 'get_note', toolId: 't1', status: 'pending' }],
        }]}
        isActive
      />,
    )
    rerender(
      <ChatRunLiveStatus
        messages={[{
          response: 'h',
          actions: [{ tool: 'get_note', toolId: 't1', status: 'pending' }],
        }]}
        isActive
      />,
    )
    await nextFrame()
    await nextFrame()
    expect(screen.getByTestId('chat-run-live-status')).toHaveTextContent('Running get_note')
  })
})
