import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BulkActionBar } from './BulkActionBar'

describe('BulkActionBar', () => {
  const defaultProps = {
    count: 3,
    onOrganize: vi.fn(),
    onArchive: vi.fn(),
    onDelete: vi.fn(),
    onClear: vi.fn(),
  }

  it('shows icon-only organize, archive, and delete buttons in normal view', () => {
    render(<BulkActionBar {...defaultProps} />)
    expect(screen.getByTestId('bulk-organize-btn')).toBeInTheDocument()
    expect(screen.getByTestId('bulk-archive-btn')).toBeInTheDocument()
    expect(screen.getByTestId('bulk-delete-btn')).toBeInTheDocument()
    expect(screen.queryByText('Organize')).not.toBeInTheDocument()
    expect(screen.queryByText('Archive')).not.toBeInTheDocument()
    expect(screen.queryByText('Delete')).not.toBeInTheDocument()
  })

  it('shows selected count', () => {
    render(<BulkActionBar {...defaultProps} count={5} />)
    expect(screen.getByText('5 selected')).toBeInTheDocument()
  })

  it('shows organize, unarchive, and delete buttons in archived view', () => {
    render(<BulkActionBar {...defaultProps} isArchivedView={true} />)
    expect(screen.getByTestId('bulk-organize-btn')).toBeInTheDocument()
    expect(screen.getByTestId('bulk-unarchive-btn')).toBeInTheDocument()
    expect(screen.getByTestId('bulk-delete-btn')).toBeInTheDocument()
    expect(screen.queryByTestId('bulk-archive-btn')).not.toBeInTheDocument()
  })

  it('exposes accessible names and a destructive variant for icon-only actions', () => {
    render(<BulkActionBar {...defaultProps} />)
    expect(screen.getByRole('button', { name: 'Organize selected notes' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Archive selected notes' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Permanently delete selected notes' })).toHaveAttribute('data-variant', 'destructive')
    expect(screen.getByRole('button', { name: 'Clear selection' })).toBeInTheDocument()
  })

  it('keeps the icon-only controls focusable and activatable', () => {
    const onOrganize = vi.fn()
    const onArchive = vi.fn()
    const onDelete = vi.fn()
    const onClear = vi.fn()

    render(
      <BulkActionBar
        {...defaultProps}
        onOrganize={onOrganize}
        onArchive={onArchive}
        onDelete={onDelete}
        onClear={onClear}
      />,
    )

    const organizeButton = screen.getByRole('button', { name: 'Organize selected notes' })
    const archiveButton = screen.getByRole('button', { name: 'Archive selected notes' })
    const deleteButton = screen.getByRole('button', { name: 'Permanently delete selected notes' })
    const clearButton = screen.getByRole('button', { name: 'Clear selection' })

    organizeButton.focus()
    expect(organizeButton).toHaveFocus()
    fireEvent.click(organizeButton)
    expect(onOrganize).toHaveBeenCalledTimes(1)

    archiveButton.focus()
    expect(archiveButton).toHaveFocus()
    fireEvent.click(archiveButton)
    expect(onArchive).toHaveBeenCalledTimes(1)

    deleteButton.focus()
    expect(deleteButton).toHaveFocus()
    fireEvent.click(deleteButton)
    expect(onDelete).toHaveBeenCalledTimes(1)

    clearButton.focus()
    expect(clearButton).toHaveFocus()
    fireEvent.click(clearButton)
    expect(onClear).toHaveBeenCalledTimes(1)
  })

  it('calls onUnarchive when Unarchive button clicked in archived view', () => {
    const onUnarchive = vi.fn()
    render(<BulkActionBar {...defaultProps} isArchivedView={true} onUnarchive={onUnarchive} />)
    fireEvent.click(screen.getByTestId('bulk-unarchive-btn'))
    expect(onUnarchive).toHaveBeenCalledTimes(1)
  })
})
