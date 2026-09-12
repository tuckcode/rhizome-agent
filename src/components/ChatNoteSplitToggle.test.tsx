import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ChatNoteSplitToggle } from './ChatNoteSplitToggle'

describe('ChatNoteSplitToggle', () => {
  it('shows labeled On top and Beside choices, not icons only', () => {
    render(<ChatNoteSplitToggle split="stacked" onChange={vi.fn()} />)

    expect(screen.getByRole('radio', { name: 'Note on top of Chat' })).toHaveTextContent('On top')
    expect(screen.getByRole('radio', { name: 'Note beside Chat' })).toHaveTextContent('Beside')
    expect(screen.getByRole('radio', { name: 'Note on top of Chat' })).toHaveAttribute('aria-checked', 'true')
  })

  it('switches to beside when that label is clicked', () => {
    const onChange = vi.fn()
    render(<ChatNoteSplitToggle split="stacked" onChange={onChange} />)

    fireEvent.click(screen.getByRole('radio', { name: 'Note beside Chat' }))
    expect(onChange).toHaveBeenCalledWith('side-by-side')
  })
})
