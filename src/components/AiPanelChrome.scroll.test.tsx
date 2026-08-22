import { fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AiPanelMessageHistory } from './AiPanelChrome'
import type { AiAgentMessage } from '../lib/aiAgentConversation'

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
