import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ConflictResolverModal } from './ConflictResolverModal'
import type { ConflictFileState } from '../hooks/useConflictResolver'

function renderModal(fileStates: ConflictFileState[], overrides: Record<string, unknown> = {}) {
  const props = {
    open: true,
    fileStates,
    allResolved: true,
    committing: false,
    error: null,
    onResolveFile: vi.fn(),
    onOpenInEditor: vi.fn(),
    onCommit: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  }

  render(<ConflictResolverModal {...props} />)
  return props
}

describe('ConflictResolverModal extra coverage', () => {
  it('supports keyboard navigation and actions across the focused file', () => {
    const props = renderModal([
      { file: 'notes/project.md', resolution: null, resolving: false },
      { file: 'notes/plan.md', resolution: null, resolving: false },
    ])

    const list = screen.getByTestId('conflict-file-list')

    fireEvent.keyDown(list, { key: 'ArrowDown' })
    fireEvent.keyDown(list, { key: 'T' })
    expect(props.onResolveFile).toHaveBeenCalledWith('notes/plan.md', 'theirs')

    fireEvent.keyDown(list, { key: 'ArrowUp' })
    fireEvent.keyDown(list, { key: 'k' })
    expect(props.onResolveFile).toHaveBeenCalledWith('notes/project.md', 'ours')

    fireEvent.keyDown(list, { key: 'o' })
    expect(props.onOpenInEditor).toHaveBeenCalledWith('notes/project.md')

    fireEvent.keyDown(list, { key: 'Enter' })
    expect(props.onCommit).toHaveBeenCalledTimes(1)

    fireEvent.keyDown(list, { key: 'Escape' })
    expect(props.onClose).toHaveBeenCalled()
  })

  it('ignores binary open shortcuts, resolving rows, and modifier-assisted actions', () => {
    const props = renderModal([
      { file: 'images/photo.png', resolution: null, resolving: false },
      { file: 'notes/plan.md', resolution: null, resolving: true },
    ], { allResolved: false })

    const list = screen.getByTestId('conflict-file-list')

    fireEvent.keyDown(list, { key: 'o' })
    expect(props.onOpenInEditor).not.toHaveBeenCalled()

    fireEvent.focus(screen.getByTestId('conflict-file-notes/plan.md'))
    fireEvent.keyDown(list, { key: 'K' })
    fireEvent.keyDown(list, { key: 'T', ctrlKey: true })

    expect(props.onResolveFile).not.toHaveBeenCalled()
    expect(props.onCommit).not.toHaveBeenCalled()
  })
})
