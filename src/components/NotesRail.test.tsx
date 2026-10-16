import { render, screen } from '@testing-library/react'
import { createRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { FileText } from '@phosphor-icons/react'
import { NotesRail } from './NotesRail'
import { notesRailRecentItems, notesRailSectionItems } from '../lib/notesRailItems'
import type { VaultEntry } from '../types'

vi.mock('./ui/action-tooltip', () => ({
  ActionTooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

function renderRail(overrides: Partial<React.ComponentProps<typeof NotesRail>> = {}) {
  const props: React.ComponentProps<typeof NotesRail> = {
    mode: 'auto',
    onModeChange: vi.fn(),
    expanded: false,
    overlaying: false,
    width: 240,
    panelRef: createRef<HTMLDivElement>(),
    items: [
      { id: 'all', label: 'All Notes', icon: FileText, onSelect: vi.fn() },
    ],
    ...overrides,
  }
  return render(<NotesRail {...props} />)
}

describe('NotesRail', () => {
  it('keeps CommandRail collapsed width and puts the mode button first', () => {
    renderRail()
    const rail = screen.getByTestId('notes-panel-rail')
    expect(rail).toHaveStyle({ width: '46px' })
    expect(rail).toHaveAttribute('data-mode', 'auto')
    expect(rail).toHaveAttribute('data-expanded', 'false')
    const mode = screen.getByTestId('notes-panel-mode-trigger')
    const all = screen.getByTestId('notes-rail-all')
    expect(mode.compareDocumentPosition(all) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.getByTestId('notes-rail-all')).toHaveStyle({ width: '32px', height: '32px' })
    expect(screen.getByTestId('notes-rail-all')).toHaveAccessibleName('All Notes')
    expect(screen.getByTestId('notes-rail-all').textContent).toBe('')
  })

  it('overlays Chat without a backdrop when Auto expands', () => {
    renderRail({ expanded: true, overlaying: true, width: 240 })
    const rail = screen.getByTestId('notes-panel-rail')
    expect(rail).toHaveAttribute('data-overlay', 'true')
    expect(rail).toHaveClass('bg-background')
    expect(rail).toHaveClass('shadow-md')
    expect(rail).toHaveStyle({ marginLeft: '-194px', width: '240px', zIndex: '40' })
    expect(screen.getByTestId('notes-panel-rail-expanded')).toBeInTheDocument()
    expect(screen.queryByTestId('notes-rail-all')).not.toBeInTheDocument()
  })

  it('marks unsaved recent notes with a neutral dot', () => {
    renderRail({
      items: [{
        id: 'note:/vault/a.md',
        label: 'Draft',
        icon: FileText,
        unsaved: true,
        onSelect: vi.fn(),
      }],
    })
    const dot = screen.getByTestId('notes-rail-unsaved')
    expect(dot).toHaveStyle({ background: 'var(--text-muted)' })
    expect(dot).not.toHaveStyle({ background: 'var(--accent-green)' })
  })
})

describe('notes rail item helpers', () => {
  it('lists Inbox, All Notes, and Changes without counts', () => {
    const items = notesRailSectionItems({
      showInbox: true,
      selection: { kind: 'filter', filter: 'inbox' },
      onSelect: vi.fn(),
    })
    expect(items.map((item) => item.id)).toEqual(['inbox', 'all', 'changes'])
    expect(items[0]?.active).toBe(true)
  })

  it('takes recent notes and flags unsaved without mint', () => {
    const entries = [
      { path: '/vault/old.md', filename: 'old.md', title: 'Old', isA: 'Note', archived: false, modifiedAt: 1, icon: null },
      { path: '/vault/new.md', filename: 'new.md', title: 'New', isA: 'Note', archived: false, modifiedAt: 9, icon: null },
    ] as VaultEntry[]
    const items = notesRailRecentItems({
      entries,
      getNoteStatus: (path) => (path.endsWith('new.md') ? 'unsaved' : 'clean'),
      onSelectNote: vi.fn(),
    })
    expect(items[0]?.id).toBe('note:/vault/new.md')
    expect(items[0]?.unsaved).toBe(true)
  })
})
