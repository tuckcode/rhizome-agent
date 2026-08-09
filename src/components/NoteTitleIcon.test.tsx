import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { NoteTitleIcon } from './NoteTitleIcon'

describe('NoteTitleIcon', () => {
  it('renders a single emoji icon as text', () => {
    render(<NoteTitleIcon icon="🚀" testId="note-title-icon" />)

    expect(screen.getByTestId('note-title-icon')).toHaveTextContent('🚀')
  })

  it('renders a Phosphor icon when the name is recognized', () => {
    const { container } = render(<NoteTitleIcon icon="cooking pot" testId="note-title-icon" className="mr-1" />)

    const icon = screen.getByTestId('note-title-icon')
    expect(icon.tagName.toLowerCase()).toBe('svg')
    expect(container.querySelector('span.inline-flex.mr-1')).not.toBeNull()
  })

  it('renders an image when the icon is an http url', () => {
    const { container } = render(<NoteTitleIcon icon="https://example.com/favicon.png" testId="note-title-icon" className="mr-1" />)

    const icon = screen.getByTestId('note-title-icon')
    expect(icon.tagName.toLowerCase()).toBe('img')
    expect(icon).toHaveAttribute('src', 'https://example.com/favicon.png')
    expect(container.querySelector('span.inline-flex.mr-1')).not.toBeNull()
  })

  it('renders nothing for an unrecognized icon value', () => {
    const { container } = render(<NoteTitleIcon icon="definitely-not-a-real-icon" testId="note-title-icon" />)

    expect(screen.queryByTestId('note-title-icon')).not.toBeInTheDocument()
    expect(container).toBeEmptyDOMElement()
  })
})
