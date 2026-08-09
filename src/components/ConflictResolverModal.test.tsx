import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ConflictResolverModal } from './ConflictResolverModal'
import type { ConflictFileState } from '../hooks/useConflictResolver'

function makeFileStates(overrides?: Partial<ConflictFileState>[]): ConflictFileState[] {
  const defaults: ConflictFileState[] = [
    { file: 'notes/project.md', resolution: null, resolving: false },
    { file: 'notes/plan.md', resolution: null, resolving: false },
  ]
  if (!overrides) return defaults
  return defaults.map((d, i) => ({ ...d, ...(overrides[i] ?? {}) }))
}

function renderModal(overrides: Record<string, unknown> = {}) {
  const props = {
    open: true,
    fileStates: makeFileStates(),
    allResolved: false,
    committing: false,
    error: null,
    onResolveFile: vi.fn(),
    onOpenInEditor: vi.fn(),
    onCommit: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  }
  return { ...render(<ConflictResolverModal {...props} />), props }
}

describe('ConflictResolverModal', () => {
  it('renders conflict file list when open', () => {
    renderModal()
    expect(screen.getByText('Resolve Merge Conflicts')).toBeInTheDocument()
    expect(screen.getByTestId('conflict-file-list')).toBeInTheDocument()
    expect(screen.getByTestId('conflict-file-notes/project.md')).toBeInTheDocument()
    expect(screen.getByTestId('conflict-file-notes/plan.md')).toBeInTheDocument()
  })

  it('shows file count description', () => {
    renderModal()
    expect(screen.getByText(/2 files have merge conflicts/)).toBeInTheDocument()
  })

  it('shows singular description for one file', () => {
    renderModal({ fileStates: [{ file: 'note.md', resolution: null, resolving: false }] })
    expect(screen.getByText(/1 file has merge conflicts/)).toBeInTheDocument()
  })

  it('calls onResolveFile when Keep mine is clicked', () => {
    const { props } = renderModal()
    fireEvent.click(screen.getByTestId('resolve-ours-notes/project.md'))
    expect(props.onResolveFile).toHaveBeenCalledWith('notes/project.md', 'ours')
  })

  it('calls onResolveFile when Keep theirs is clicked', () => {
    const { props } = renderModal()
    fireEvent.click(screen.getByTestId('resolve-theirs-notes/plan.md'))
    expect(props.onResolveFile).toHaveBeenCalledWith('notes/plan.md', 'theirs')
  })

  it('calls onOpenInEditor when Open in editor is clicked', () => {
    const { props } = renderModal()
    fireEvent.click(screen.getByTestId('resolve-open-notes/project.md'))
    expect(props.onOpenInEditor).toHaveBeenCalledWith('notes/project.md')
  })

  it('hides Open in editor for binary files', () => {
    renderModal({
      fileStates: [{ file: 'images/photo.png', resolution: null, resolving: false }],
    })
    expect(screen.queryByTestId('resolve-open-images/photo.png')).not.toBeInTheDocument()
    // Keep mine/theirs should still be visible
    expect(screen.getByTestId('resolve-ours-images/photo.png')).toBeInTheDocument()
  })

  it('Commit & continue button is disabled when not all resolved', () => {
    renderModal({ allResolved: false })
    expect(screen.getByTestId('conflict-commit-btn')).toBeDisabled()
  })

  it('Commit & continue button is enabled when all resolved', () => {
    renderModal({ allResolved: true })
    expect(screen.getByTestId('conflict-commit-btn')).toBeEnabled()
  })

  it('calls onCommit when Commit & continue is clicked', () => {
    const { props } = renderModal({ allResolved: true })
    fireEvent.click(screen.getByTestId('conflict-commit-btn'))
    expect(props.onCommit).toHaveBeenCalled()
  })

  it('shows committing state', () => {
    renderModal({ allResolved: true, committing: true })
    expect(screen.getByText('Committing…')).toBeInTheDocument()
    expect(screen.getByTestId('conflict-commit-btn')).toBeDisabled()
  })

  it('shows error message', () => {
    renderModal({ error: 'git commit failed: user.email not set' })
    expect(screen.getByTestId('conflict-error')).toHaveTextContent('git commit failed')
  })

  it('shows resolution labels after file is resolved', () => {
    renderModal({
      fileStates: makeFileStates([{ resolution: 'ours' }, { resolution: 'theirs' }]),
    })
    expect(screen.getByText('Keeping mine')).toBeInTheDocument()
    expect(screen.getByText('Keeping theirs')).toBeInTheDocument()
  })

  it('shows spinner when file is resolving', () => {
    renderModal({
      fileStates: [{ file: 'note.md', resolution: null, resolving: true }],
    })
    // Buttons hidden during resolving, spinner shown instead
    expect(screen.queryByTestId('resolve-ours-note.md')).not.toBeInTheDocument()
  })

  it('calls onClose when Cancel is clicked', () => {
    const { props } = renderModal()
    fireEvent.click(screen.getByText('Cancel'))
    expect(props.onClose).toHaveBeenCalled()
  })

  it('shows keyboard shortcut hint', () => {
    renderModal()
    expect(screen.getByText(/K = keep mine/)).toBeInTheDocument()
  })
})
