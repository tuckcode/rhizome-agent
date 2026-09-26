import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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
  /**
   * C78 originally kept the title from *ever* shrinking (`shrink-0
   * whitespace-nowrap`, no truncate) so "Changes" stayed fully readable next
   * to a row of fixed 32px icons. That let the title's own box overflow past
   * its shrunken flex parent at narrow widths, and the trailing shortcuts /
   * sort / columns group — painted later in DOM order — rendered on top of
   * the spilling text (Astra's 2026-09-26 half-screen repro: the shortcuts
   * box drawn over "Notes"). Truncating with an ellipsis instead means the
   * title clips cleanly inside its own box rather than bleeding into a
   * sibling that then covers it; the min-w-[5.5rem] floor still keeps short
   * titles like "Changes" fully visible in the common case.
   */
  it('keeps Changes readable beside a row of fixed 32px icons', () => {
    renderHeader({ title: 'Changes' })

    const title = screen.getByRole('heading', { name: 'Changes' })
    expect(title).toHaveClass('truncate')
    expect(title.className).toMatch(/min-w-\[5\.5rem\]/)

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

  it('never lets the shortcuts group sit out of flow ahead of the title', () => {
    renderHeader({ title: 'Notes' })

    const title = screen.getByRole('heading', { name: 'Notes' })
    const shortcuts = screen.getByTestId('notes-chrome-shortcuts')
    // Regression for the half-screen repro: the shortcuts box must be a
    // normal flex sibling *after* the title in DOM order, not absolutely
    // positioned on top of it.
    expect(shortcuts.className).not.toMatch(/\babsolute\b/)
    expect(title.compareDocumentPosition(shortcuts) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(shortcuts.closest('[data-testid="note-list-header-optional-tools"]')).toHaveClass('shrink-0')
  })
})

/**
 * Simulates the title actually being truncated (scrollWidth > clientWidth),
 * the same signal `useNoteListHeaderOverflow` uses to move the workspace
 * shortcuts / sort / columns group into the "…" menu. jsdom has no layout,
 * so both widths are mocked directly on whichever element the hook measures.
 */
function mockCollapsedNoteListHeaderOverflow() {
  const requestFrame = vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((callback) => {
    callback(0)
    return 1
  })
  const cancelFrame = vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => {})
  const scrollWidths = vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(400)
  const clientWidths = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(100)

  return () => {
    requestFrame.mockRestore()
    cancelFrame.mockRestore()
    scrollWidths.mockRestore()
    clientWidths.mockRestore()
  }
}

describe('NoteListHeader — optional tools move into overflow when the title is truncated', () => {
  it('keeps shortcuts, sort, and columns inline by default', () => {
    renderHeader({ title: 'Inbox' })

    expect(screen.getByTestId('note-list-header-optional-tools')).toBeInTheDocument()
    expect(screen.getByTestId('sort-button-__list__')).toBeInTheDocument()
    expect(screen.queryByTestId('note-list-header-overflow-trigger')).not.toBeInTheDocument()
  })

  it('moves shortcuts, sort, and columns into the overflow menu once the title truncates', async () => {
    const restoreMeasurement = mockCollapsedNoteListHeaderOverflow()

    try {
      renderHeader({ title: 'Inbox' })

      await waitFor(() => {
        expect(screen.queryByTestId('note-list-header-optional-tools')).not.toBeInTheDocument()
      })

      const trigger = screen.getByTestId('note-list-header-overflow-trigger')
      fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false })
      const menu = await screen.findByTestId('note-list-header-overflow-menu')

      expect(within(menu).getByTestId('notes-chrome-shortcuts')).toBeInTheDocument()
      expect(within(menu).getByTestId('sort-button-__list__')).toBeInTheDocument()
    } finally {
      restoreMeasurement()
    }
  })

  it('never renders the sort button twice, even while collapsing', async () => {
    const restoreMeasurement = mockCollapsedNoteListHeaderOverflow()

    try {
      renderHeader({ title: 'Inbox' })

      await waitFor(() => {
        expect(screen.queryByTestId('note-list-header-optional-tools')).not.toBeInTheDocument()
      })

      fireEvent.pointerDown(screen.getByTestId('note-list-header-overflow-trigger'), { button: 0, ctrlKey: false })
      await screen.findByTestId('note-list-header-overflow-menu')

      expect(screen.getAllByTestId('sort-button-__list__')).toHaveLength(1)
    } finally {
      restoreMeasurement()
    }
  })

  it('always keeps search and create note inline, never in the overflow menu', async () => {
    const restoreMeasurement = mockCollapsedNoteListHeaderOverflow()

    try {
      renderHeader({ title: 'Inbox' })

      await waitFor(() => {
        expect(screen.queryByTestId('note-list-header-optional-tools')).not.toBeInTheDocument()
      })

      expect(screen.getByRole('button', { name: 'Search notes' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Create new note' })).toBeInTheDocument()
    } finally {
      restoreMeasurement()
    }
  })
})
