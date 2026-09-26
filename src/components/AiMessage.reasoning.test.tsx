import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { AiMessage } from './AiMessage'

/**
 * Real MarkdownContent (this file does not mock it) so we can see lists and
 * line breaks, not the string dump used in AiMessage.test.tsx.
 */
describe('AiMessage reasoning markdown', () => {
  it('keeps newlines visible in expanded thinking', () => {
    render(
      <AiMessage
        userMessage="Ask"
        reasoning={'First line\nSecond line'}
        reasoningDone={false}
        actions={[]}
      />,
    )
    const content = screen.getByTestId('reasoning-content')
    expect(content.querySelector('br')).toBeTruthy()
    expect(content).toHaveTextContent('First line')
    expect(content).toHaveTextContent('Second line')
  })

  it('renders a markdown list when thinking is expanded', () => {
    render(
      <AiMessage
        userMessage="Ask"
        reasoning={'- check the vault\n- then reply'}
        reasoningDone={false}
        actions={[]}
      />,
    )
    const items = screen.getByTestId('reasoning-content').querySelectorAll('li')
    expect(items).toHaveLength(2)
    expect(items[0]).toHaveTextContent('check the vault')
    expect(items[1]).toHaveTextContent('then reply')
  })

  it('still collapses when the turn is done, then lists after expand', () => {
    render(
      <AiMessage
        userMessage="Ask"
        reasoning={'- check the vault\n- then reply'}
        reasoningDone
        actions={[]}
      />,
    )
    expect(screen.queryByTestId('reasoning-content')).toBeNull()
    fireEvent.click(screen.getByTestId('reasoning-toggle'))
    expect(screen.getByTestId('reasoning-content').querySelectorAll('li')).toHaveLength(2)
  })

  it('keeps a scrolled-up reading position while more thinking arrives', () => {
    const { rerender } = render(
      <AiMessage
        userMessage="Ask"
        reasoning={'line\n'.repeat(40)}
        reasoningDone={false}
        actions={[]}
      />,
    )
    const content = screen.getByTestId('reasoning-content')
    Object.defineProperty(content, 'scrollHeight', { value: 800, configurable: true })
    Object.defineProperty(content, 'clientHeight', { value: 280, configurable: true })
    Object.defineProperty(content, 'scrollTop', { value: 40, writable: true, configurable: true })
    fireEvent.scroll(content)

    rerender(
      <AiMessage
        userMessage="Ask"
        reasoning={`${'line\n'.repeat(40)}and a newer line`}
        reasoningDone={false}
        actions={[]}
      />,
    )

    expect(content.scrollTop).toBe(40)
  })

  it('follows the newest thinking line while the reader is at the bottom', () => {
    const { rerender } = render(
      <AiMessage
        userMessage="Ask"
        reasoning={'line\n'.repeat(40)}
        reasoningDone={false}
        actions={[]}
      />,
    )
    const content = screen.getByTestId('reasoning-content')
    Object.defineProperty(content, 'scrollHeight', { value: 800, configurable: true })
    Object.defineProperty(content, 'clientHeight', { value: 280, configurable: true })
    Object.defineProperty(content, 'scrollTop', { value: 520, writable: true, configurable: true })
    fireEvent.scroll(content)

    rerender(
      <AiMessage
        userMessage="Ask"
        reasoning={`${'line\n'.repeat(40)}and a newer line`}
        reasoningDone={false}
        actions={[]}
      />,
    )

    expect(content.scrollTop).toBe(800)
  })
})
