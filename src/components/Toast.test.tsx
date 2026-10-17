import { fireEvent, render, screen } from '@testing-library/react'
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

  it('links the Releases page label in updater copy', () => {
    render(<Toast message={UPDATER_USER_MESSAGES.inAppUpdatesUnavailable} onDismiss={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Releases page' }))
    expect(mockOpenExternalUrl).toHaveBeenCalledWith('https://github.com/tuckcode/rhizome-agent/releases')
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
})
