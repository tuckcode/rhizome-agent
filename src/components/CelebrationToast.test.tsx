import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CelebrationToast } from './CelebrationToast'

describe('CelebrationToast', () => {
  it('shows the agent’s words', () => {
    render(<CelebrationToast message="Migration landed" onDismiss={vi.fn()} />)

    expect(screen.getByText('Migration landed')).toBeInTheDocument()
  })

  it('attributes it when the agent said who is celebrating', () => {
    render(<CelebrationToast message="Migration landed" from="Prime" onDismiss={vi.fn()} />)

    expect(screen.getByText('From Prime')).toBeInTheDocument()
  })

  it('leaves out the attribution line when there is nobody to name', () => {
    render(<CelebrationToast message="Migration landed" onDismiss={vi.fn()} />)

    expect(screen.queryByText(/^From /)).not.toBeInTheDocument()
  })

  /**
   * A congratulation nobody can hear is not a congratulation. `role="status"`
   * announces it without stealing focus, which matters more here than usual:
   * the visual half of this celebration is a decorative canvas that screen
   * readers are told to ignore.
   */
  it('announces itself politely rather than grabbing focus', () => {
    render(<CelebrationToast message="Migration landed" onDismiss={vi.fn()} />)

    const toast = screen.getByRole('status')
    expect(toast).toHaveAttribute('aria-live', 'polite')
    expect(document.activeElement).toBe(document.body)
  })

  it('can be dismissed early', () => {
    const onDismiss = vi.fn()
    render(<CelebrationToast message="Migration landed" onDismiss={onDismiss} />)

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))

    expect(onDismiss).toHaveBeenCalled()
  })
})
