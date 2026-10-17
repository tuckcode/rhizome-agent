import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { UPDATER_USER_MESSAGES } from '../lib/updaterUserMessages'
import { Toast } from './Toast'

const mockOpenExternalUrl = vi.fn()
vi.mock('../utils/url', () => ({
  openExternalUrl: (...args: unknown[]) => mockOpenExternalUrl(...args),
}))

describe('Toast', () => {
  it('renders the message', () => {
    render(<Toast message='Saved “Kernel notes” to raw/inbox' onDismiss={vi.fn()} />)
    expect(screen.getByRole('status')).toHaveTextContent('Saved “Kernel notes” to raw/inbox')
  })

  it('links the Releases page label only for exact updater copy', () => {
    render(<Toast message={UPDATER_USER_MESSAGES.inAppUpdatesUnavailable} onDismiss={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Releases page' }))
    expect(mockOpenExternalUrl).toHaveBeenCalledWith('https://github.com/tuckcode/rhizome-agent/releases')
  })

  it('does not link Releases page in unrelated toast text', () => {
    render(<Toast message='Tip: open the Releases page from the menu' onDismiss={vi.fn()} />)
    expect(screen.queryByRole('button', { name: 'Releases page' })).toBeNull()
    expect(screen.getByRole('status')).toHaveTextContent('Tip: open the Releases page from the menu')
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

  it('a toast with actions stays until one is chosen', () => {
    vi.useFakeTimers()
    const onDismiss = vi.fn()
    render(
      <Toast
        message="plan.md changed on disk."
        actionLabel="Keep mine"
        onAction={vi.fn()}
        secondaryActionLabel="Reload"
        onSecondaryAction={vi.fn()}
        onDismiss={onDismiss}
      />,
    )
    act(() => { vi.advanceTimersByTime(6000) })
    expect(onDismiss).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Keep mine' })).toBeInTheDocument()
    vi.useRealTimers()
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
