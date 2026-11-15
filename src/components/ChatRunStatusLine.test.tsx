import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ChatRunStatusLine } from './ChatRunStatusLine'

describe('ChatRunStatusLine', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-14T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('keeps its row and shows no text when no run is active', () => {
    render(<ChatRunStatusLine messages={[]} isActive={false} />)
    const line = screen.getByTestId('chat-run-status-line')
    expect(line).toHaveAttribute('data-run-state', 'idle')
    expect(line).toHaveTextContent('')
  })

  it('says Thinking when a run starts', () => {
    render(<ChatRunStatusLine messages={[{ response: '' }]} isActive />)
    const line = screen.getByTestId('chat-run-status-line')
    expect(line).toHaveAttribute('data-run-state', 'thinking')
    expect(line).toHaveTextContent('Thinking')
  })

  it('names the tool and shows its elapsed time', () => {
    render(
      <ChatRunStatusLine
        isActive
        messages={[{ actions: [{ tool: 'bash', toolId: 't1', status: 'pending' }] }]}
      />,
    )
    expect(screen.getByTestId('chat-run-status-line')).toHaveTextContent('Running bash')
    act(() => { vi.advanceTimersByTime(7000) })
    expect(screen.getByTestId('chat-run-status-line')).toHaveTextContent('Running bash · 7s')
  })

  it('says that the run waits for the user', () => {
    render(
      <ChatRunStatusLine
        isActive
        messages={[{ actions: [{ tool: 'bash', toolId: 't1', status: 'pending', approval: {} }] }]}
      />,
    )
    const line = screen.getByTestId('chat-run-status-line')
    expect(line).toHaveAttribute('data-run-state', 'approval')
    expect(line).toHaveTextContent('Waiting for your approval')
  })

  it('reports no response after 30 seconds and offers Stop', () => {
    const onStop = vi.fn()
    render(<ChatRunStatusLine messages={[{ response: 'Half a rep' }]} isActive onStop={onStop} />)
    expect(screen.queryByRole('button', { name: 'Stop' })).toBeNull()
    act(() => { vi.advanceTimersByTime(31_000) })
    const line = screen.getByTestId('chat-run-status-line')
    expect(line).toHaveAttribute('data-run-state', 'quiet')
    expect(line).toHaveTextContent('No response for 31 seconds')
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }))
    expect(onStop).toHaveBeenCalledTimes(1)
  })

  it('starts the quiet clock again when an event arrives', () => {
    const { rerender } = render(<ChatRunStatusLine messages={[{ response: 'One' }]} isActive />)
    act(() => { vi.advanceTimersByTime(31_000) })
    expect(screen.getByTestId('chat-run-status-line')).toHaveAttribute('data-run-state', 'quiet')
    rerender(<ChatRunStatusLine messages={[{ response: 'One two' }]} isActive />)
    expect(screen.getByTestId('chat-run-status-line')).toHaveAttribute('data-run-state', 'writing')
  })

  it('shows why the worker did not start', () => {
    render(<ChatRunStatusLine messages={[]} isActive={false} failureReason="Sign in again" />)
    const line = screen.getByTestId('chat-run-status-line')
    expect(line).toHaveAttribute('data-run-state', 'failed')
    expect(line).toHaveTextContent('Sign in again')
  })

  it('is not a second live region', () => {
    render(<ChatRunStatusLine messages={[{ response: '' }]} isActive />)
    const line = screen.getByTestId('chat-run-status-line')
    expect(line).not.toHaveAttribute('role')
    expect(line).not.toHaveAttribute('aria-live')
  })
})
