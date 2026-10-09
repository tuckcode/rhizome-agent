import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ChatComposerFoot } from './ChatComposerFoot'

describe('ChatComposerFoot', () => {
  it('shows a quiet spinner while a turn is running, not the last tool name', () => {
    render(<ChatComposerFoot working />)

    const foot = screen.getByTestId('chat-composer-foot')
    expect(foot).toHaveAttribute('aria-label', 'Working')
    expect(foot).not.toHaveTextContent('Working')
    expect(foot).not.toHaveTextContent('last tool')
    expect(foot).not.toHaveTextContent('ipython')
    expect(foot.querySelector('.animate-spin')).toBeTruthy()
  })

  it('does not claim Escape stops a running turn', () => {
    render(<ChatComposerFoot working />)

    // Escape reaches useAiPanelFocus.ts:58, which calls onClose() whenever focus is
    // anywhere inside the panel -- so in ChatHome it leaves Chat entirely. Nothing
    // stops a turn from the keyboard; onStop is reachable only by clicking Stop.
    const foot = screen.getByTestId('chat-composer-foot')
    expect(foot).not.toHaveTextContent('Esc')
    expect(foot).not.toHaveTextContent('⌘')
  })

  it('renders nothing while idle', () => {
    const { container } = render(<ChatComposerFoot />)
    expect(container).toBeEmptyDOMElement()
  })
})
