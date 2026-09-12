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
})
