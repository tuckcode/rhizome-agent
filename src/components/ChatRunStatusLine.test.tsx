import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ChatRunStatusLine } from './ChatRunStatusLine'
import { chatRunSnapshotFromMessages, nextChatRunAnnouncement } from '../lib/chatRunLiveStatus'
import { chatRunFailure, CHATGPT_SIGN_IN_EXPIRED, ENGINE_DID_NOT_START, PROVIDER_SIGN_IN_NEEDED } from '../lib/chatRunStatus'

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
    expect(screen.getByTestId('chat-run-status-line')).toHaveTextContent('Running command')
    act(() => { vi.advanceTimersByTime(7000) })
    expect(screen.getByTestId('chat-run-status-line')).toHaveTextContent('Running command · 7s')
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
    expect(screen.queryByTestId('chat-run-action-stop')).toBeNull()
    act(() => { vi.advanceTimersByTime(31_000) })
    const line = screen.getByTestId('chat-run-status-line')
    expect(line).toHaveAttribute('data-run-state', 'quiet')
    expect(line).toHaveTextContent('No response for 31 seconds')
    fireEvent.click(screen.getByTestId('chat-run-action-stop'))
    expect(onStop).toHaveBeenCalledTimes(1)
  })

  it('starts the quiet clock again when an event arrives', () => {
    const { rerender } = render(<ChatRunStatusLine messages={[{ response: 'One' }]} isActive />)
    act(() => { vi.advanceTimersByTime(31_000) })
    expect(screen.getByTestId('chat-run-status-line')).toHaveAttribute('data-run-state', 'quiet')
    rerender(<ChatRunStatusLine messages={[{ response: 'One two' }]} isActive />)
    expect(screen.getByTestId('chat-run-status-line')).toHaveAttribute('data-run-state', 'writing')
  })

  it('says the engine did not start, offers Retry, and keeps the raw cause behind Copy error', async () => {
    const onRetry = vi.fn()
    const writeText = vi.fn(async () => {})
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    const cause = 'The Prime worker exited before it started: rhizome-worker not found.'
    render(<ChatRunStatusLine messages={[]} isActive={false} failure={chatRunFailure(cause)} onRetry={onRetry} />)
    const line = screen.getByTestId('chat-run-status-line')
    expect(line).toHaveAttribute('data-run-state', 'failed')
    expect(screen.getByTestId('chat-run-status-line')).toHaveTextContent(ENGINE_DID_NOT_START)
    expect(line).not.toHaveTextContent(/prime|rhizome-worker/iu)
    fireEvent.click(screen.getByTestId('chat-run-action-retry'))
    expect(onRetry).toHaveBeenCalledTimes(1)
    await act(async () => {
      fireEvent.click(screen.getByTestId('chat-run-action-copy-error'))
    })
    expect(writeText).toHaveBeenCalledWith(cause)
    expect(screen.getByTestId('chat-run-action-copy-error')).toHaveTextContent('Copied')
  })

  it('keeps the failed line out of the live region so the failure reads once', () => {
    const failure = chatRunFailure('Worker binary missing')
    render(<ChatRunStatusLine messages={[]} isActive={false} failure={failure} />)
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.getByTestId('chat-run-status-line').querySelector('[aria-live]')).toBeNull()
    // The one announcement comes from ChatRunLiveStatus.
    const idle = chatRunSnapshotFromMessages([], false)
    expect(nextChatRunAnnouncement(idle, { ...idle, failure: failure?.label })).toBe(ENGINE_DID_NOT_START)
    expect(nextChatRunAnnouncement({ ...idle, failure: failure?.label }, { ...idle, failure: failure?.label })).toBeNull()
  })

  it('leads an expired ChatGPT sign-in with its cause and offers Sign in', () => {
    const onSignIn = vi.fn()
    render(
      <ChatRunStatusLine
        messages={[]}
        isActive={false}
        failure={chatRunFailure('Error: Sign in again', { chatgptTarget: true })}
        onSignIn={onSignIn}
      />,
    )
    expect(screen.getByTestId('chat-run-status-line')).toHaveTextContent(CHATGPT_SIGN_IN_EXPIRED)
    fireEvent.click(screen.getByTestId('chat-run-action-sign_in'))
    expect(onSignIn).toHaveBeenCalledTimes(1)
  })

  it('does not offer the ChatGPT sign-in for another provider', () => {
    render(<ChatRunStatusLine messages={[]} isActive={false} failure={chatRunFailure('anthropic: not signed in')} />)
    expect(screen.getByTestId('chat-run-status-line')).toHaveTextContent(PROVIDER_SIGN_IN_NEEDED)
    expect(screen.queryByTestId('chat-run-action-sign_in')).toBeNull()
  })

  it('offers Continue with the real step count at the step limit', () => {
    const onContinue = vi.fn()
    render(
      <ChatRunStatusLine
        messages={[{ response: 'Stopped here.', capped: { steps: 40, max_steps: 40 } }]}
        isActive={false}
        onContinue={onContinue}
      />,
    )
    const button = screen.getByTestId('chat-run-action-continue')
    expect(button).toHaveTextContent('Continue for 40 more steps')
    fireEvent.click(button)
    expect(onContinue).toHaveBeenCalledTimes(1)
  })

  it('gives the quiet Stop its shortcut', () => {
    render(<ChatRunStatusLine messages={[{ response: 'Half' }]} isActive onStop={() => {}} />)
    act(() => { vi.advanceTimersByTime(31_000) })
    const stop = screen.getByTestId('chat-run-action-stop')
    expect(stop).toHaveAttribute('aria-keyshortcuts')
    expect(stop.querySelector('kbd')?.textContent).toMatch(/\.$/)
  })

  it('keeps a tool elapsed time while its output streams', () => {
    const tool = (output: string) => [{ actions: [{ tool: 'bash', toolId: 't1', status: 'pending', output }] }]
    const { rerender } = render(<ChatRunStatusLine isActive messages={tool('')} />)
    act(() => { vi.advanceTimersByTime(4000) })
    rerender(<ChatRunStatusLine isActive messages={tool('line 1')} />)
    act(() => { vi.advanceTimersByTime(3000) })
    expect(screen.getByTestId('chat-run-status-line')).toHaveTextContent('Running command · 7s')
  })

  it('keeps the oldest tool time when a parallel tool finishes', () => {
    const tools = (second: string) => [{ actions: [
      { tool: 'bash', toolId: 't1', status: 'pending' },
      { tool: 'read_file', toolId: 't2', status: second },
    ] }]
    const { rerender } = render(<ChatRunStatusLine isActive messages={tools('pending')} />)
    act(() => { vi.advanceTimersByTime(6000) })
    rerender(<ChatRunStatusLine isActive messages={tools('done')} />)
    act(() => { vi.advanceTimersByTime(1000) })
    expect(screen.getByTestId('chat-run-status-line')).toHaveTextContent('Running command · 7s')
  })

  it('does not let a local marker freeze the quiet clock', () => {
    const marker = { localMarker: 'Model changed to gpt-5' }
    const { rerender } = render(<ChatRunStatusLine isActive messages={[{ response: 'One' }, marker]} />)
    act(() => { vi.advanceTimersByTime(29_000) })
    rerender(<ChatRunStatusLine isActive messages={[{ response: 'One two' }, marker]} />)
    act(() => { vi.advanceTimersByTime(5000) })
    expect(screen.getByTestId('chat-run-status-line')).toHaveAttribute('data-run-state', 'writing')
  })

  it('is not a second live region while a run works', () => {
    render(<ChatRunStatusLine messages={[{ response: '' }]} isActive />)
    const line = screen.getByTestId('chat-run-status-line')
    expect(line).not.toHaveAttribute('role')
    expect(line).not.toHaveAttribute('aria-live')
    expect(screen.queryByRole('status')).toBeNull()
  })
})
