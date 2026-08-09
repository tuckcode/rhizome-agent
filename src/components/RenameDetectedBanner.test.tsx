import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { RenameDetectedBanner } from './RenameDetectedBanner'

describe('RenameDetectedBanner', () => {
  const renames = [
    { old_path: 'old-note.md', new_path: 'new-note.md' },
    { old_path: 'folder/draft.md', new_path: 'folder/published.md' },
  ]

  it('renders nothing when renames is empty', () => {
    const { container } = render(
      <RenameDetectedBanner renames={[]} onUpdate={vi.fn()} onDismiss={vi.fn()} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('shows banner with rename count', () => {
    render(<RenameDetectedBanner renames={renames} onUpdate={vi.fn()} onDismiss={vi.fn()} />)
    expect(screen.getByText(/2 files? renamed/i)).toBeInTheDocument()
  })

  it('shows Update wikilinks button', () => {
    render(<RenameDetectedBanner renames={renames} onUpdate={vi.fn()} onDismiss={vi.fn()} />)
    expect(screen.getByText('Update wikilinks')).toBeInTheDocument()
  })

  it('calls onUpdate when Update button clicked', () => {
    const onUpdate = vi.fn()
    render(<RenameDetectedBanner renames={renames} onUpdate={onUpdate} onDismiss={vi.fn()} />)
    fireEvent.click(screen.getByText('Update wikilinks'))
    expect(onUpdate).toHaveBeenCalledOnce()
  })

  it('calls onDismiss when Ignore button clicked', () => {
    const onDismiss = vi.fn()
    render(<RenameDetectedBanner renames={renames} onUpdate={vi.fn()} onDismiss={onDismiss} />)
    fireEvent.click(screen.getByText('Ignore'))
    expect(onDismiss).toHaveBeenCalledOnce()
  })
})
