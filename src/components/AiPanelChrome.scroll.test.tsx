import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AiPanelMessageHistory } from './AiPanelChrome'
import type { AiAgentMessage } from '../lib/aiAgentConversation'

const { startDragging } = vi.hoisted(() => ({
  startDragging: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({ startDragging }),
}))

function message(userMessage: string, response: string): AiAgentMessage {
  return { userMessage, response, actions: [] }
}

function historyProps(messages: AiAgentMessage[]) {
  return {
    agentLabel: 'Prime',
    agentReadiness: 'ready' as const,
    messages,
    isActive: true,
    hasContext: false,
  }
}

/** jsdom reports every box as 0×0; give the scroller real geometry. */
function setScrollGeometry(element: Element, { scrollTop, scrollHeight, clientHeight }: {
  scrollTop: number, scrollHeight: number, clientHeight: number
}) {
  Object.defineProperty(element, 'scrollHeight', { value: scrollHeight, configurable: true })
  Object.defineProperty(element, 'clientHeight', { value: clientHeight, configurable: true })
  Object.defineProperty(element, 'scrollTop', { value: scrollTop, writable: true, configurable: true })
}

function scroller(container: HTMLElement): Element {
  const element = container.querySelector('.overflow-y-auto')
  if (!element) throw new Error('scroll container not found')
  return element
}

let scrollIntoView: ReturnType<typeof vi.fn>

beforeEach(() => {
  scrollIntoView = vi.fn()
  startDragging.mockClear()
  Element.prototype.scrollIntoView = scrollIntoView as unknown as Element['scrollIntoView']
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('AiPanelMessageHistory follow-the-stream scrolling', () => {
  it('follows new output while the reader is at the bottom', () => {
    const messages = [message('one', 'first')]
    const { container, rerender } = render(<AiPanelMessageHistory {...historyProps(messages)} />)

    setScrollGeometry(scroller(container), { scrollTop: 900, scrollHeight: 1000, clientHeight: 100 })
    fireEvent.scroll(scroller(container))
    scrollIntoView.mockClear()

    rerender(<AiPanelMessageHistory {...historyProps([{ ...messages[0], response: 'first and more' }])} />)

    expect(scrollIntoView).toHaveBeenCalled()
  })

  it('leaves the reader alone when they have scrolled up to read', () => {
    const messages = [message('one', 'first')]
    const { container, rerender } = render(<AiPanelMessageHistory {...historyProps(messages)} />)

    // Scrolled well up: 600px of content still below the fold.
    setScrollGeometry(scroller(container), { scrollTop: 300, scrollHeight: 1000, clientHeight: 100 })
    fireEvent.scroll(scroller(container))
    scrollIntoView.mockClear()

    rerender(<AiPanelMessageHistory {...historyProps([{ ...messages[0], response: 'first and much more' }])} />)

    expect(scrollIntoView).not.toHaveBeenCalled()
  })

  it('resumes following once the reader scrolls back down', () => {
    const messages = [message('one', 'first')]
    const { container, rerender } = render(<AiPanelMessageHistory {...historyProps(messages)} />)

    setScrollGeometry(scroller(container), { scrollTop: 300, scrollHeight: 1000, clientHeight: 100 })
    fireEvent.scroll(scroller(container))
    rerender(<AiPanelMessageHistory {...historyProps([{ ...messages[0], response: 'grown' }])} />)
    scrollIntoView.mockClear()

    setScrollGeometry(scroller(container), { scrollTop: 900, scrollHeight: 1000, clientHeight: 100 })
    fireEvent.scroll(scroller(container))
    rerender(<AiPanelMessageHistory {...historyProps([{ ...messages[0], response: 'grown again' }])} />)

    expect(scrollIntoView).toHaveBeenCalled()
  })

  it('jumps back down when the reader sends a new message', () => {
    const messages = [message('one', 'first')]
    const { container, rerender } = render(<AiPanelMessageHistory {...historyProps(messages)} />)

    setScrollGeometry(scroller(container), { scrollTop: 300, scrollHeight: 1000, clientHeight: 100 })
    fireEvent.scroll(scroller(container))
    scrollIntoView.mockClear()

    // A new exchange, not a longer response: sending is an explicit "take me
    // to the bottom", unlike output arriving on its own.
    rerender(<AiPanelMessageHistory {...historyProps([...messages, message('two', '')])} />)

    expect(scrollIntoView).toHaveBeenCalled()
  })
})

describe('AiPanelMessageHistory text selection vs window drag', () => {
  it('does not start a window drag when dragging across a chat message', () => {
    // Chat history is a drag surface for empty chrome, but message bodies
    // must stay selectable — otherwise copy/paste is impossible.
    render(<AiPanelMessageHistory {...historyProps([message('copy me', '429 rate limit')])} />)

    const bubble = screen.getByText('copy me')
    expect(bubble.closest('[data-no-drag]')).not.toBeNull()

    fireEvent.mouseDown(bubble, { button: 0, clientX: 10, clientY: 10 })
    fireEvent.mouseMove(window, { clientX: 40, clientY: 10 })

    expect(startDragging).not.toHaveBeenCalled()
  })

  it('still starts a window drag from empty padding around messages', () => {
    render(<AiPanelMessageHistory {...historyProps([message('copy me', 'ok')])} />)

    fireEvent.mouseDown(screen.getByTestId('ai-panel-message-history'), {
      button: 0,
      clientX: 10,
      clientY: 10,
    })
    fireEvent.mouseMove(window, { clientX: 40, clientY: 10 })

    expect(startDragging).toHaveBeenCalledOnce()
  })
})

describe('AiPanelMessageHistory C70 clock', () => {
  it('shows the clock when a turn carries createdAtMs', () => {
    const createdAtMs = new Date(2026, 8, 6, 15, 35, 0).getTime()
    render(<AiPanelMessageHistory {...historyProps([{
      ...message('Hello AI', 'ok'),
      createdAtMs,
    }])} />)

    expect(screen.getByTestId('message-timestamp')).toHaveTextContent('3:35p')
  })

  it('omits the clock when the turn has no createdAtMs', () => {
    render(<AiPanelMessageHistory {...historyProps([message('Hello AI', 'ok')])} />)

    expect(screen.queryByTestId('message-timestamp')).not.toBeInTheDocument()
  })
})

describe('AiPanelMessageHistory latest-reply marker', () => {
  it('marks only the newest assistant reply, then moves when a newer one lands', () => {
    const messages = [
      { ...message('one', 'first'), id: 'a' },
      { ...message('two', 'second'), id: 'b' },
    ]
    const { rerender } = render(<AiPanelMessageHistory {...historyProps(messages)} />)

    expect(screen.getAllByTestId('latest-assistant-reply-marker')).toHaveLength(1)
    expect(screen.getByTestId('latest-assistant-reply-marker').parentElement).toHaveTextContent('second')
    expect(screen.getByTestId('latest-assistant-reply-marker').parentElement).not.toHaveTextContent('first')

    rerender(<AiPanelMessageHistory {...historyProps([
      ...messages,
      { ...message('three', 'third'), id: 'c' },
    ])} />)

    expect(screen.getAllByTestId('latest-assistant-reply-marker')).toHaveLength(1)
    expect(screen.getByTestId('latest-assistant-reply-marker').parentElement).toHaveTextContent('third')
  })
})
