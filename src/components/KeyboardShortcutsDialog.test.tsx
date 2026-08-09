import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { KeyboardShortcutsDialog } from './KeyboardShortcutsDialog'
import { formatShortcutDisplay } from '../hooks/appCommandCatalog'

describe('KeyboardShortcutsDialog', () => {
  it('renders shortcut groups when open', () => {
    render(
      <KeyboardShortcutsDialog open onOpenChange={vi.fn()} locale="en" />,
    )

    const dialog = screen.getByTestId('keyboard-shortcuts-dialog')
    expect(dialog).toBeTruthy()
    expect(within(dialog).getByRole('heading', { name: 'Keyboard shortcuts' })).toBeTruthy()
    expect(within(dialog).getByText('Reload vault')).toBeTruthy()
    expect(within(dialog).getByText(formatShortcutDisplay({ display: '⌘⇧R' }))).toBeTruthy()
    expect(within(dialog).getByText(formatShortcutDisplay({ display: '⌘/' }))).toBeTruthy()
  })

  it('notifies parent when dismissed', () => {
    const onOpenChange = vi.fn()
    render(
      <KeyboardShortcutsDialog open onOpenChange={onOpenChange} locale="en" />,
    )

    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
