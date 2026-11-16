import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { HarnessMarker } from './HarnessMarker'

describe('HarnessMarker', () => {
  it('shows the Rhizome mark for native chats', () => {
    render(<HarnessMarker harness="rhizome" />)
    const marker = screen.getByRole('img', { name: 'Rhizome' })
    expect(marker).toHaveAttribute('title', 'Rhizome')
    expect(marker.querySelector('[data-testid="brand-mark"]')).not.toBeNull()
  })

  it('shows a neutral terminal glyph and the plain text Claude Code, with no Claude mark', () => {
    render(<HarnessMarker harness="claude_code" />)
    const marker = screen.getByRole('img', { name: 'Claude Code' })
    expect(marker).toHaveAttribute('title', 'Claude Code')
    expect(marker.querySelector('img')).toBeNull()
    expect(marker.querySelector('[data-testid="brand-mark"]')).toBeNull()
    expect(marker.innerHTML).not.toContain('claude-code.svg')
    expect(marker.querySelector('svg')).not.toBeNull()
  })

  it('can sit inside a control that already names it', () => {
    render(<HarnessMarker harness="claude_code" decorative />)
    expect(screen.queryByRole('img', { name: 'Claude Code' })).toBeNull()
    expect(screen.getByTestId('harness-marker-claude_code')).toHaveAttribute('aria-hidden', 'true')
  })
})
