import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { APP_COMMAND_EVENT_NAME, APP_COMMAND_IDS } from '../../hooks/appCommandDispatcher'
import { trackEvent } from '../../lib/telemetry'
import { NoteListHeader } from './NoteListHeader'

vi.mock('../../lib/telemetry', () => ({
  trackEvent: vi.fn(),
}))

const baseProps = {
  title: 'Inbox',
  typeDocument: null,
  isEntityView: false,
  listSort: 'modified' as const,
  listDirection: 'desc' as const,
  customProperties: [],
  searchVisible: false,
  search: '',
  isSearching: false,
  searchInputRef: { current: null },
  onSortChange: vi.fn(),
  onCreateNote: vi.fn(),
  onOpenType: vi.fn(),
  onToggleSearch: vi.fn(),
  onSearchChange: vi.fn(),
  onSearchKeyDown: vi.fn(),
}

function renderHeader(overrides: Partial<Parameters<typeof NoteListHeader>[0]> = {}) {
  return render(<NoteListHeader {...baseProps} {...overrides} />)
}

describe('NoteListHeader expand sidebar button', () => {
  beforeEach(() => {
    vi.mocked(trackEvent).mockClear()
  })

  it('keeps the expand-sidebar button hidden when the sidebar is open', () => {
    renderHeader({ sidebarCollapsed: false })

    expect(screen.queryByRole('button', { name: 'Expand sidebar' })).not.toBeInTheDocument()
  })

  it('dispatches the full-layout app command from the collapsed note-list header', () => {
    const commandListener = vi.fn()
    window.addEventListener(APP_COMMAND_EVENT_NAME, commandListener)

    try {
      renderHeader({ sidebarCollapsed: true })

      fireEvent.click(screen.getByRole('button', { name: 'Expand sidebar' }))

      expect(commandListener).toHaveBeenCalledTimes(1)
      expect((commandListener.mock.calls[0]?.[0] as CustomEvent<string>).detail).toBe(APP_COMMAND_IDS.viewAll)
      expect(trackEvent).toHaveBeenCalledWith('sidebar_expanded_from_note_list_header')
    } finally {
      window.removeEventListener(APP_COMMAND_EVENT_NAME, commandListener)
    }
  })
})

describe('NoteListHeader Inbox title (C78)', () => {
  it('keeps a min-width that can show Inbox beside a row of fixed 32px icons', () => {
    renderHeader({ title: 'Inbox' })

    const title = screen.getByRole('heading', { name: 'Inbox' })
    expect(title).not.toHaveClass('min-w-0')
    expect(title.className).toMatch(/min-w-\[3\.25rem\]/)

    const search = screen.getByRole('button', { name: 'Search notes' })
    expect(search.className).toMatch(/!w-\[32px\]/)
  })

  it('groups Research, Settings, Mycelium, and Wiki Graph as icon shortcuts', () => {
    renderHeader({ title: 'Inbox' })

    const group = screen.getByTestId('notes-chrome-shortcuts')
    expect(group).toHaveAttribute('aria-label', 'Workspace shortcuts')
    expect(screen.getByRole('button', { name: 'Open the Research panel' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open settings' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mycelium' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Wiki Graph' })).toBeInTheDocument()
  })
})
