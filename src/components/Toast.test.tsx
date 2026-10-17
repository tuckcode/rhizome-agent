import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Toast } from './Toast'

describe('Toast', () => {
  it('renders the message', () => {
    render(<Toast message='Saved “Kernel notes” to raw/inbox' onDismiss={vi.fn()} />)
    expect(screen.getByRole('status')).toHaveTextContent('Saved “Kernel notes” to raw/inbox')
  })

  it('offers an Open action that opens the saved note', () => {
    const onAction = vi.fn()
    const onDismiss = vi.fn()
    render(
      <Toast
        message='Saved “Kernel notes” to raw/inbox'
        actionLabel="Open"
        onAction={onAction}
        onDismiss={onDismiss}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Open' }))
    expect(onAction).toHaveBeenCalledOnce()
    expect(onDismiss).toHaveBeenCalledOnce()
  })

  it('offers two actions for a save conflict', () => {
    const keep = vi.fn()
    const reload = vi.fn()
    const onDismiss = vi.fn()
    render(
      <Toast
        message="plan.md changed on disk."
        actionLabel="Keep mine"
        onAction={keep}
        secondaryActionLabel="Reload"
        onSecondaryAction={reload}
        onDismiss={onDismiss}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Reload' }))
    expect(reload).toHaveBeenCalledOnce()
    expect(keep).not.toHaveBeenCalled()
    expect(onDismiss).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: 'Keep mine' })).toBeInTheDocument()
  })
})
