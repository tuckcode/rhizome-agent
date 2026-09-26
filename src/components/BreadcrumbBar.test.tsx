import type { ComponentProps } from 'react'
import { render, screen, fireEvent, act, within, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { BreadcrumbBar } from './BreadcrumbBar'
import { formatShortcutDisplay } from '../hooks/appCommandCatalog'
import type { VaultEntry } from '../types'

const dragRegionMouseDown = vi.fn()

vi.mock('../hooks/useDragRegion', () => ({
  useDragRegion: () => ({ onMouseDown: dragRegionMouseDown }),
}))

const baseEntry: VaultEntry = {
  path: '/vault/note/test.md',
  filename: 'test.md',
  title: 'Test Note',
  isA: 'Note',
  aliases: [],
  belongsTo: [],
  relatedTo: [],
  status: null,
  archived: false,
  modifiedAt: 1700000000,
  createdAt: null,
  fileSize: 100,
  snippet: '',
  wordCount: 0,
  relationships: {},
  icon: null,
  color: null,
  order: null,
  outgoingLinks: [],
  template: null,
  sort: null,
  sidebarLabel: null,
  view: null,
  visible: null,
  properties: {},
  organized: false,
  favorite: false,
  favoriteIndex: null,
  listPropertiesDisplay: [],
  hasH1: false,
}

const archivedEntry: VaultEntry = {
  ...baseEntry,
  archived: true,
}

const defaultProps = {
  wordCount: 100,
  showDiffToggle: false,
  diffMode: false,
  diffLoading: false,
  onToggleDiff: vi.fn(),
}

type BreadcrumbBarRenderProps = Omit<ComponentProps<typeof BreadcrumbBar>, 'entry'>

function makeEntry(overrides: Partial<VaultEntry> = {}): VaultEntry {
  return { ...baseEntry, ...overrides }
}

function renderBreadcrumb(
  entryOverrides: Partial<VaultEntry> = {},
  props: Partial<BreadcrumbBarRenderProps> = {},
) {
  const entry = makeEntry(entryOverrides)
  return {
    entry,
    ...render(<BreadcrumbBar entry={entry} {...defaultProps} {...props} />),
  }
}

function renderEditableFilenameBreadcrumb(
  entryOverrides: Partial<VaultEntry> = {},
  props: Partial<BreadcrumbBarRenderProps> = {},
) {
  const onRenameFilename = vi.fn()
  const result = renderBreadcrumb(entryOverrides, { ...props, onRenameFilename })
  return { ...result, onRenameFilename }
}

function startFilenameRename() {
  fireEvent.doubleClick(screen.getByTestId('breadcrumb-filename-trigger'))
  return screen.getByTestId('breadcrumb-filename-input')
}

function expectDisplayTitleState(
  entryOverrides: Partial<VaultEntry>,
  expected: { displayTitle: string | null; filenameStem: string },
  props: Partial<BreadcrumbBarRenderProps> = {},
) {
  renderEditableFilenameBreadcrumb(entryOverrides, props)

  if (expected.displayTitle) {
    expect(screen.getByTestId('breadcrumb-display-title')).toHaveTextContent(expected.displayTitle)
  } else {
    expect(screen.queryByTestId('breadcrumb-display-title')).not.toBeInTheDocument()
  }
  expect(screen.getByTestId('breadcrumb-filename-trigger')).toHaveTextContent(expected.filenameStem)
}

async function expectTooltip(trigger: HTMLElement, ...parts: string[]) {
  act(() => {
    fireEvent.focus(trigger)
  })
  const tooltip = await screen.findByRole('tooltip')
  for (const part of parts) {
    expect(tooltip).toHaveTextContent(part)
  }
  act(() => {
    fireEvent.blur(trigger)
  })
}

async function openOverflowMenu() {
  fireEvent.pointerDown(screen.getByRole('button', { name: 'More note actions' }), {
    button: 0,
    ctrlKey: false,
  })
  return screen.findByRole('menu')
}

function mockCollapsedBreadcrumbOverflow() {
  const requestFrame = vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((callback) => {
    callback(0)
    return 1
  })
  const cancelFrame = vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => {})
  const rects = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () {
    if (this.classList.contains('breadcrumb-bar__actions')) {
      return DOMRect.fromRect({ x: 200, y: 0, width: 20, height: 52 })
    }
    return DOMRect.fromRect({ x: 0, y: 0, width: 500, height: 52 })
  })
  const scrollWidths = vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockImplementation(function () {
    return this.classList.contains('breadcrumb-bar__actions') ? 400 : 500
  })

  return () => {
    requestFrame.mockRestore()
    cancelFrame.mockRestore()
    rects.mockRestore()
    scrollWidths.mockRestore()
  }
}

function mockOscillatingBreadcrumbOverflow() {
  const requestFrame = vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((callback) => {
    callback(0)
    return 1
  })
  const cancelFrame = vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => {})
  const rects = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () {
    if (this.classList.contains('breadcrumb-bar__actions')) {
      const collapsed = this.getAttribute('data-overflow-collapsed') === 'true'
      return DOMRect.fromRect({ x: collapsed ? 1000 : 200, y: 0, width: 20, height: 52 })
    }
    return DOMRect.fromRect({ x: 0, y: 0, width: 500, height: 52 })
  })
  const scrollWidths = vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockImplementation(function () {
    return this.classList.contains('breadcrumb-bar__actions') ? 400 : 500
  })

  return () => {
    requestFrame.mockRestore()
    cancelFrame.mockRestore()
    rects.mockRestore()
    scrollWidths.mockRestore()
  }
}

describe('BreadcrumbBar — drag region', () => {
  it('forwards mousedown events to the shared drag-region hook', () => {
    const { container } = render(<BreadcrumbBar entry={baseEntry} {...defaultProps} />)
    const bar = container.querySelector('.breadcrumb-bar') as HTMLElement

    fireEvent.mouseDown(bar, { button: 0 })

    expect(dragRegionMouseDown).toHaveBeenCalledOnce()
  })

  it('does not combine the custom drag handler with a native drag marker', () => {
    const { container } = render(<BreadcrumbBar entry={baseEntry} {...defaultProps} />)
    const bar = container.firstElementChild as HTMLElement
    expect(bar.dataset.tauriDragRegion).toBeUndefined()
  })

  it('lets the center spacer bubble to the custom drag handler', () => {
    const { container } = render(<BreadcrumbBar entry={baseEntry} {...defaultProps} />)
    const spacer = container.querySelector('.breadcrumb-bar__drag-spacer')
    expect(spacer).not.toHaveAttribute('data-tauri-drag-region')
    expect(spacer).toHaveAttribute('aria-hidden', 'true')
  })
})

describe('BreadcrumbBar — delete', () => {
  it('shows delete in the overflow menu', async () => {
    render(<BreadcrumbBar entry={baseEntry} {...defaultProps} onDelete={vi.fn()} />)
    const menu = await openOverflowMenu()
    expect(within(menu).getByRole('menuitem', { name: 'Delete this note' })).toBeInTheDocument()
  })

  it('calls onDelete from the overflow menu', async () => {
    const onDelete = vi.fn()
    render(<BreadcrumbBar entry={baseEntry} {...defaultProps} onDelete={onDelete} />)
    const menu = await openOverflowMenu()
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Delete this note' }))
    expect(onDelete).toHaveBeenCalledOnce()
  })
})

describe('BreadcrumbBar — archive/unarchive', () => {
  it('shows archive in the overflow menu for non-archived note', async () => {
    render(<BreadcrumbBar entry={baseEntry} {...defaultProps} onArchive={vi.fn()} onUnarchive={vi.fn()} />)
    const menu = await openOverflowMenu()
    expect(within(menu).getByRole('menuitem', { name: 'Archive this note' })).toBeInTheDocument()
    expect(within(menu).queryByRole('menuitem', { name: 'Restore this archived note' })).not.toBeInTheDocument()
  })

  it('shows unarchive in the overflow menu for archived note', async () => {
    render(<BreadcrumbBar entry={archivedEntry} {...defaultProps} onArchive={vi.fn()} onUnarchive={vi.fn()} />)
    const menu = await openOverflowMenu()
    expect(within(menu).getByRole('menuitem', { name: 'Restore this archived note' })).toBeInTheDocument()
    expect(within(menu).queryByRole('menuitem', { name: 'Archive this note' })).not.toBeInTheDocument()
  })

  it('calls onArchive from the overflow menu', async () => {
    const onArchive = vi.fn()
    render(<BreadcrumbBar entry={baseEntry} {...defaultProps} onArchive={onArchive} />)
    const menu = await openOverflowMenu()
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Archive this note' }))
    expect(onArchive).toHaveBeenCalledOnce()
  })

  it('calls onUnarchive from the overflow menu', async () => {
    const onUnarchive = vi.fn()
    render(<BreadcrumbBar entry={archivedEntry} {...defaultProps} onUnarchive={onUnarchive} />)
    const menu = await openOverflowMenu()
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Restore this archived note' }))
    expect(onUnarchive).toHaveBeenCalledOnce()
  })
})

describe('BreadcrumbBar — reload vault', () => {
  it('shows a reload control when onReloadVault is provided', () => {
    const onReloadVault = vi.fn()
    renderBreadcrumb({}, { onReloadVault })

    const button = screen.getByTestId('breadcrumb-reload-vault')
    fireEvent.click(button)

    expect(onReloadVault).toHaveBeenCalledTimes(1)
  })

  it('hides the reload control when onReloadVault is omitted', () => {
    renderBreadcrumb()
    expect(screen.queryByTestId('breadcrumb-reload-vault')).toBeNull()
  })
})

describe('BreadcrumbBar — file actions', () => {
  it('reveals the current file from the breadcrumb toolbar', () => {
    const onRevealFile = vi.fn()
    render(<BreadcrumbBar entry={baseEntry} {...defaultProps} onRevealFile={onRevealFile} />)

    fireEvent.click(screen.getByRole('button', { name: 'Reveal in Finder' }))

    expect(onRevealFile).toHaveBeenCalledWith('/vault/note/test.md')
  })

  it('copies the current file path from the breadcrumb toolbar', () => {
    const onCopyFilePath = vi.fn()
    render(<BreadcrumbBar entry={baseEntry} {...defaultProps} onCopyFilePath={onCopyFilePath} />)

    fireEvent.click(screen.getByRole('button', { name: 'Copy file path' }))

    expect(onCopyFilePath).toHaveBeenCalledWith('/vault/note/test.md')
  })

  it('copies the current note deep link from the overflow menu', async () => {
    const onCopyDeepLink = vi.fn()
    render(<BreadcrumbBar entry={baseEntry} {...defaultProps} onCopyDeepLink={onCopyDeepLink} />)

    const menu = await openOverflowMenu()
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Copy note deeplink' }))

    expect(onCopyDeepLink).toHaveBeenCalledWith(baseEntry)
  })

  it('copies the current note git URL from the overflow menu when available', async () => {
    const onCopyGitUrl = vi.fn()
    render(<BreadcrumbBar entry={baseEntry} {...defaultProps} onCopyGitUrl={onCopyGitUrl} />)

    const menu = await openOverflowMenu()
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Copy git URL' }))

    expect(onCopyGitUrl).toHaveBeenCalledWith(baseEntry)
  })

  it('does not show the note git URL action without a remote-backed handler', async () => {
    render(<BreadcrumbBar entry={baseEntry} {...defaultProps} />)

    const menu = await openOverflowMenu()

    expect(within(menu).queryByRole('menuitem', { name: 'Copy git URL' })).not.toBeInTheDocument()
  })

  it('exports the current note as PDF from the overflow menu', async () => {
    const onExportPdf = vi.fn()
    render(<BreadcrumbBar entry={baseEntry} {...defaultProps} onExportPdf={onExportPdf} />)

    const menu = await openOverflowMenu()
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Export note as PDF' }))

    expect(onExportPdf).toHaveBeenCalledOnce()
  })
})

describe('BreadcrumbBar — organized shortcut hint', () => {
  it('shows Cmd+E on the organized toggle tooltip', async () => {
    render(<BreadcrumbBar entry={baseEntry} {...defaultProps} onToggleOrganized={vi.fn()} />)
    await expectTooltip(
      screen.getByRole('button', { name: 'Set note as organized' }),
      'Set note as organized',
      formatShortcutDisplay({ display: '⌘E' }),
    )
  })

  it('hides the organized toggle when the workflow is disabled', () => {
    render(<BreadcrumbBar entry={baseEntry} {...defaultProps} />)
    expect(screen.queryByRole('button', { name: 'Set note as organized' })).not.toBeInTheDocument()
  })
})

describe('BreadcrumbBar — neighborhood action', () => {
  it("opens the current note's neighborhood from the map button", () => {
    const onEnterNeighborhood = vi.fn()
    render(<BreadcrumbBar entry={baseEntry} {...defaultProps} onEnterNeighborhood={onEnterNeighborhood} />)

    fireEvent.click(screen.getByRole('button', { name: "Open note's neighborhood" }))

    expect(onEnterNeighborhood).toHaveBeenCalledWith(baseEntry)
  })

  it('uses the requested neighborhood tooltip copy', async () => {
    render(<BreadcrumbBar entry={baseEntry} {...defaultProps} onEnterNeighborhood={vi.fn()} />)

    await expectTooltip(screen.getByRole('button', { name: "Open note's neighborhood" }), "Open note's neighborhood")
  })
})

describe('BreadcrumbBar — title in breadcrumb (always rendered, CSS-toggled)', () => {
  it('always renders title elements in the DOM', () => {
    render(<BreadcrumbBar entry={baseEntry} {...defaultProps} />)
    expect(screen.getByText('Note')).toBeInTheDocument()
    expect(screen.getByText('›')).toBeInTheDocument()
    expect(screen.getByText('test')).toBeInTheDocument()
  })

  it('shows the workspace initials label before the note type when workspace metadata is present', () => {
    renderBreadcrumb({
      isA: 'Responsibility',
      workspace: {
        id: 'brian',
        label: 'Brian',
        alias: 'brian',
        path: '/brian',
        shortLabel: 'BR',
        color: 'purple',
        icon: null,
        mounted: true,
        available: true,
        defaultForNewNotes: false,
      },
    })

    const workspaceLabel = screen.getByTestId('breadcrumb-workspace-label')
    const typeLabel = screen.getByText('Responsibility')
    expect(workspaceLabel).toHaveTextContent('BR')
    expect(workspaceLabel).toHaveAttribute('title', 'Brian (brian)')
    expect(workspaceLabel.compareDocumentPosition(typeLabel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('does not render emoji note icons in the breadcrumb filename', () => {
    const entryWithEmoji = { ...baseEntry, icon: '🚀' }
    render(<BreadcrumbBar entry={entryWithEmoji} {...defaultProps} />)
    expect(screen.getByTestId('breadcrumb-filename-trigger')).toHaveTextContent('test')
    expect(screen.queryByText('🚀')).not.toBeInTheDocument()
  })

  it('does not render Phosphor note icons in the breadcrumb filename', () => {
    const entryWithPhosphor = { ...baseEntry, icon: 'cooking-pot' }
    render(<BreadcrumbBar entry={entryWithPhosphor} {...defaultProps} />)
    expect(screen.getByTestId('breadcrumb-filename-trigger')).toHaveTextContent('test')
    expect(screen.queryByTestId('breadcrumb-note-icon')).not.toBeInTheDocument()
  })

  it('falls back to "Note" when isA is null', () => {
    const entryNoType = { ...baseEntry, isA: null }
    render(<BreadcrumbBar entry={entryNoType} {...defaultProps} />)
    expect(screen.getByText('Note')).toBeInTheDocument()
  })

  it('separator visibility is controlled by data-title-hidden while using the shared border chrome', () => {
    const { container } = render(<BreadcrumbBar entry={baseEntry} {...defaultProps} />)
    const bar = container.querySelector('.breadcrumb-bar')!
    expect(bar).toHaveClass('border-b', 'border-transparent')
    expect(bar).toHaveAttribute('data-title-hidden')
  })

  it('keeps the breadcrumb title visible in raw mode', () => {
    const { container } = render(
      <BreadcrumbBar entry={baseEntry} {...defaultProps} rawMode onToggleRaw={vi.fn()} />,
    )

    expect(container.querySelector('.breadcrumb-bar')).toHaveAttribute('data-title-hidden')
  })
})

describe('BreadcrumbBar — filename controls', () => {
  it('shows a legacy display title while keeping the filename visible', () => {
    expectDisplayTitleState(
      {
        title: 'Reference Planning Notes',
        filename: 'ref-570.md',
        hasH1: false,
      },
      { displayTitle: 'Reference Planning Notes', filenameStem: 'ref-570' },
    )
  })

  it('uses opened content when stale metadata marks a legacy note as H1-titled', () => {
    expectDisplayTitleState(
      {
        title: 'Reference Planning Notes',
        filename: 'ref-570.md',
        hasH1: true,
      },
      { displayTitle: 'Reference Planning Notes', filenameStem: 'ref-570' },
      {
        content: '---\ntitle: Reference Planning Notes\ntype: Note\n---\n\nBody without an H1.',
      },
    )
  })

  it('keeps content-derived H1 notes focused on the filename breadcrumb', () => {
    expectDisplayTitleState(
      {
        title: 'Reference Planning Notes',
        filename: 'manual-filename.md',
        hasH1: false,
      },
      { displayTitle: null, filenameStem: 'manual-filename' },
      {
        content: '---\ntitle: Reference Planning Notes\n---\n\n# Canonical H1\n\nBody.',
      },
    )
  })

  it('does not duplicate the display title when the filename already matches it', () => {
    expectDisplayTitleState(
      {
        title: 'Reference Planning Notes',
        filename: 'reference-planning-notes.md',
        hasH1: false,
      },
      { displayTitle: null, filenameStem: 'reference-planning-notes' },
    )
  })

  it('does not duplicate the display title when the filename matches with spaces', () => {
    expectDisplayTitleState(
      {
        title: 'Reference Planning Notes',
        filename: 'Reference Planning Notes.md',
        hasH1: false,
      },
      { displayTitle: null, filenameStem: 'Reference Planning Notes' },
    )
  })

  it('keeps H1-titled notes focused on the filename breadcrumb', () => {
    expectDisplayTitleState(
      {
        title: 'Reference Planning Notes',
        filename: 'manual-filename.md',
        hasH1: true,
      },
      { displayTitle: null, filenameStem: 'manual-filename' },
    )
  })

  it('shows the sync button when the filename diverges from the title slug', () => {
    renderEditableFilenameBreadcrumb({ title: 'Fresh Title', filename: 'untitled-note-123.md' })
    expect(screen.getByTestId('breadcrumb-sync-button')).toBeInTheDocument()
  })

  it('hides the sync button when the filename already matches the title slug', () => {
    renderEditableFilenameBreadcrumb({ title: 'Test Note', filename: 'test-note.md' })
    expect(screen.queryByTestId('breadcrumb-sync-button')).not.toBeInTheDocument()
  })

  it('uses live content title state to hide stale entry-title sync actions', () => {
    renderEditableFilenameBreadcrumb(
      { title: 'Old Title', filename: 'fresh-title.md', hasH1: false },
      { content: '# Fresh Title\n\nBody' },
    )

    expect(screen.queryByTestId('breadcrumb-display-title')).not.toBeInTheDocument()
    expect(screen.queryByTestId('breadcrumb-sync-button')).not.toBeInTheDocument()
  })

  it('uses the live H1 as the sync target while the entry title is stale', () => {
    const { entry, onRenameFilename } = renderEditableFilenameBreadcrumb(
      { title: 'Old Title', filename: 'old-title.md', hasH1: false },
      { content: '# Fresh Title\n\nBody' },
    )

    fireEvent.click(screen.getByTestId('breadcrumb-sync-button'))

    expect(onRenameFilename).toHaveBeenCalledWith(entry.path, 'fresh-title')
  })

  it('clicking the sync button renames the file to the title slug', () => {
    const { entry, onRenameFilename } = renderEditableFilenameBreadcrumb({
      title: 'Fresh Title',
      filename: 'untitled-note-123.md',
    })

    fireEvent.click(screen.getByTestId('breadcrumb-sync-button'))

    expect(onRenameFilename).toHaveBeenCalledWith(entry.path, 'fresh-title')
  })

  it('lets keyboard users press Enter on the filename to start editing', () => {
    renderEditableFilenameBreadcrumb()

    fireEvent.keyDown(screen.getByTestId('breadcrumb-filename-trigger'), { key: 'Enter' })

    expect(screen.getByTestId('breadcrumb-filename-input')).toHaveValue('test')
  })

  it('double-clicking the filename enters edit mode and Enter confirms the rename', () => {
    const { entry, onRenameFilename } = renderEditableFilenameBreadcrumb()

    const input = startFilenameRename()
    fireEvent.change(input, { target: { value: 'renamed-file' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onRenameFilename).toHaveBeenCalledWith(entry.path, 'renamed-file')
  })

  it('pressing Escape while editing cancels the inline rename', () => {
    const { onRenameFilename } = renderEditableFilenameBreadcrumb()

    const input = startFilenameRename()
    fireEvent.change(input, { target: { value: 'renamed-file' } })
    fireEvent.keyDown(input, { key: 'Escape' })

    expect(onRenameFilename).not.toHaveBeenCalled()
    expect(screen.queryByTestId('breadcrumb-filename-input')).not.toBeInTheDocument()
  })

  it('blur confirms the inline rename when the value changed', () => {
    const { entry, onRenameFilename } = renderEditableFilenameBreadcrumb()

    const input = startFilenameRename()
    fireEvent.change(input, { target: { value: 'renamed-on-blur' } })
    fireEvent.blur(input)

    expect(onRenameFilename).toHaveBeenCalledWith(entry.path, 'renamed-on-blur')
  })
})

describe('BreadcrumbBar — leading layout control', () => {
  it('sits the layout control on the notes header, before the action cluster', () => {
    const { container } = render(
      <BreadcrumbBar
        entry={baseEntry}
        {...defaultProps}
        leadingControl={<div data-testid="note-layout-toggle">On top</div>}
      />,
    )

    const toggle = screen.getByTestId('note-layout-toggle')
    const actions = container.querySelector('.breadcrumb-bar__actions')
    expect(toggle).toBeInTheDocument()
    expect(actions).toBeTruthy()
    expect(toggle.compareDocumentPosition(actions as Node) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})

describe('BreadcrumbBar — action buttons always right-aligned', () => {
  it('actions container has ml-auto so buttons are always right-aligned', () => {
    const { container } = render(<BreadcrumbBar entry={baseEntry} {...defaultProps} />)
    const actions = container.querySelector('.breadcrumb-bar__actions')
    expect(actions).toBeInTheDocument()
    expect(actions).toHaveClass('ml-auto')
    expect(actions).toHaveStyle({ gap: '8px' })
  })

  it('keeps grouped action buttons evenly spaced', () => {
    render(
      <BreadcrumbBar
        entry={baseEntry}
        {...defaultProps}
        noteWidth="normal"
        onToggleNoteWidth={vi.fn()}
        onRevealFile={vi.fn()}
        onCopyFilePath={vi.fn()}
      />,
    )

    const fileActionsGroup = screen.getByTestId('breadcrumb-reveal-file').closest('.breadcrumb-bar__overflowable-action')
    expect(fileActionsGroup).toHaveClass('gap-2')
    const widthActionGroup = screen.getByRole('button', { name: 'Switch to wide note width' }).closest('.breadcrumb-bar__overflowable-action')
    expect(widthActionGroup).toHaveClass('gap-2')
  })

  it('end-aligns toolbar action tooltips so zoomed windows keep them inside the right edge', async () => {
    render(
      <BreadcrumbBar
        entry={baseEntry}
        {...defaultProps}
        onToggleFavorite={vi.fn()}
      />,
    )

    act(() => {
      fireEvent.focus(screen.getByRole('button', { name: 'Add to favorites' }))
    })

    const tooltip = await screen.findByRole('tooltip')
    expect(document.querySelector('[data-slot="tooltip-content"]')).toHaveAttribute('data-align', 'end')
    expect(tooltip).toHaveTextContent('Add to favorites')
  })

  it('lets the title use the free space before the fixed drag gap', () => {
    const { container } = render(<BreadcrumbBar entry={baseEntry} {...defaultProps} />)

    expect(container.querySelector('.breadcrumb-bar__title')).toHaveClass('flex-1')
    expect(container.querySelector('.breadcrumb-bar__drag-spacer')).toHaveClass('w-6', 'shrink-0')
    expect(container.querySelector('.breadcrumb-bar__drag-spacer')).not.toHaveClass('flex-1')
  })

  it('does not render the unused backlinks or more-actions placeholders', () => {
    render(<BreadcrumbBar entry={baseEntry} {...defaultProps} />)
    expect(screen.queryByRole('button', { name: 'Backlinks are coming soon' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'More note actions are coming soon' })).not.toBeInTheDocument()
  })

  it('keeps git diff first while placing archive and delete at the bottom', async () => {
    const restoreMeasurement = mockCollapsedBreadcrumbOverflow()

    try {
      const { container } = render(
        <BreadcrumbBar
          entry={baseEntry}
          {...defaultProps}
          showDiffToggle
          noteWidth="normal"
          onToggleNoteWidth={vi.fn()}
          onRevealFile={vi.fn()}
          onCopyFilePath={vi.fn()}
          onArchive={vi.fn()}
          onDelete={vi.fn()}
        />,
      )

      await waitFor(() => {
        expect(container.querySelector('.breadcrumb-bar__actions')).toHaveAttribute('data-overflow-collapsed', 'true')
      })

      const menu = await openOverflowMenu()
      const menuLabels = within(menu).getAllByRole('menuitem').map((item) => item.textContent)
      expect(menuLabels[0]).toBe('Git diff')
      expect(menuLabels.slice(-3)).toEqual(['Copy note deeplink', 'Archive this note', 'Delete this note'])
    } finally {
      restoreMeasurement()
    }
  })

  it('does not duplicate visible lower-priority toolbar actions in the permanent overflow menu', async () => {
    render(
      <BreadcrumbBar
        entry={baseEntry}
        {...defaultProps}
        noteWidth="normal"
        onToggleNoteWidth={vi.fn()}
        onRevealFile={vi.fn()}
        onCopyFilePath={vi.fn()}
        onEnterNeighborhood={vi.fn()}
      />,
    )

    const menu = await openOverflowMenu()
    expect(within(menu).queryByRole('menuitem', { name: 'Switch to wide note width' })).not.toBeInTheDocument()
    expect(within(menu).queryByRole('menuitem', { name: 'Reveal in Finder' })).not.toBeInTheDocument()
    expect(within(menu).queryByRole('menuitem', { name: 'Copy file path' })).not.toBeInTheDocument()
    expect(within(menu).queryByRole('menuitem', { name: "Open note's neighborhood" })).not.toBeInTheDocument()
    expect(within(menu).getByRole('menuitem', { name: 'Copy note deeplink' })).toBeInTheDocument()
  })

  it('exposes lower-priority actions when overflow hides their toolbar buttons', async () => {
    const restoreMeasurement = mockCollapsedBreadcrumbOverflow()

    try {
      const { container } = render(
        <BreadcrumbBar
          entry={baseEntry}
          {...defaultProps}
          noteWidth="normal"
          onToggleNoteWidth={vi.fn()}
          onRevealFile={vi.fn()}
          onCopyFilePath={vi.fn()}
          onEnterNeighborhood={vi.fn()}
        />,
      )

      await waitFor(() => {
        expect(container.querySelector('.breadcrumb-bar__actions')).toHaveAttribute('data-overflow-collapsed', 'true')
      })

      const menu = await openOverflowMenu()
      expect(within(menu).getByRole('menuitem', { name: 'Switch to wide note width' })).toBeInTheDocument()
      expect(within(menu).getByRole('menuitem', { name: 'Reveal in Finder' })).toBeInTheDocument()
      expect(within(menu).getByRole('menuitem', { name: 'Copy file path' })).toBeInTheDocument()
      expect(within(menu).getByRole('menuitem', { name: "Open note's neighborhood" })).toBeInTheDocument()
      expect(within(menu).getByRole('menuitem', { name: 'Copy note deeplink' })).toBeInTheDocument()
    } finally {
      restoreMeasurement()
    }
  })

  it('settles overflow measurement when collapsed layout would otherwise oscillate', () => {
    const restoreMeasurement = mockOscillatingBreadcrumbOverflow()
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    try {
      expect(() => {
        render(
          <BreadcrumbBar
            entry={baseEntry}
            {...defaultProps}
            noteWidth="normal"
            onToggleNoteWidth={vi.fn()}
            onRevealFile={vi.fn()}
            onCopyFilePath={vi.fn()}
            onEnterNeighborhood={vi.fn()}
          />,
        )
      }).not.toThrow()
    } finally {
      consoleError.mockRestore()
      restoreMeasurement()
    }
  })
})

describe('BreadcrumbBar — narrow layout keeps title, overflow trigger, and close visible', () => {
  it('gives the title a minimum visible width so it never collapses to a sliver', () => {
    const { container } = render(<BreadcrumbBar entry={baseEntry} {...defaultProps} />)
    expect(container.querySelector('.breadcrumb-bar__title')).toHaveClass('min-w-[6ch]')
  })

  it('moves the layout control out of the inline row once overflow collapses', async () => {
    const restoreMeasurement = mockCollapsedBreadcrumbOverflow()

    try {
      const { container } = render(
        <BreadcrumbBar
          entry={baseEntry}
          {...defaultProps}
          leadingControl={<div data-testid="note-layout-toggle">On top</div>}
        />,
      )

      await waitFor(() => {
        expect(container.querySelector('.breadcrumb-bar__actions')).toHaveAttribute('data-overflow-collapsed', 'true')
      })
      expect(container.querySelector('.breadcrumb-bar__layout-control')).not.toBeInTheDocument()
      expect(screen.queryByTestId('note-layout-toggle')).not.toBeInTheDocument()

      const menu = await openOverflowMenu()
      expect(within(menu).getByTestId('note-layout-toggle')).toBeInTheDocument()
    } finally {
      restoreMeasurement()
    }
  })

  it('keeps the layout control inline when overflow has not collapsed', () => {
    render(
      <BreadcrumbBar
        entry={baseEntry}
        {...defaultProps}
        leadingControl={<div data-testid="note-layout-toggle">On top</div>}
      />,
    )

    expect(screen.getByTestId('note-layout-toggle').closest('.breadcrumb-bar__layout-control')).toBeInTheDocument()
  })

  it('always keeps the close button outside the collapsible overflow group', () => {
    const onCloseNote = vi.fn()
    const { container } = render(<BreadcrumbBar entry={baseEntry} {...defaultProps} onCloseNote={onCloseNote} />)

    const close = screen.getByTestId('breadcrumb-close-note')
    expect(close.closest('.breadcrumb-bar__overflowable-action')).toBeNull()
    expect(container.querySelector('.breadcrumb-bar__actions')?.lastElementChild).toBe(close)
  })

  it('moves favorite, organized, reload, lock, and reveal-file actions into the overflow menu when collapsed', async () => {
    const restoreMeasurement = mockCollapsedBreadcrumbOverflow()

    try {
      const { container } = render(
        <BreadcrumbBar
          entry={baseEntry}
          {...defaultProps}
          onToggleFavorite={vi.fn()}
          onToggleOrganized={vi.fn()}
          onReloadVault={vi.fn()}
          onToggleNoteLock={vi.fn()}
          onRevealFile={vi.fn()}
          onCopyFilePath={vi.fn()}
        />,
      )

      await waitFor(() => {
        expect(container.querySelector('.breadcrumb-bar__actions')).toHaveAttribute('data-overflow-collapsed', 'true')
      })

      const menu = await openOverflowMenu()
      expect(within(menu).getByRole('menuitem', { name: 'Add to favorites' })).toBeInTheDocument()
      expect(within(menu).getByRole('menuitem', { name: 'Set note as organized' })).toBeInTheDocument()
      expect(within(menu).getByRole('menuitem', { name: 'Reload vault' })).toBeInTheDocument()
      expect(within(menu).getByRole('menuitem', { name: 'Lock note' })).toBeInTheDocument()
      expect(within(menu).getByRole('menuitem', { name: 'Reveal in Finder' })).toBeInTheDocument()
    } finally {
      restoreMeasurement()
    }
  })

  it('clicking the favorite item in the overflow menu calls the same handler as the inline button', async () => {
    const restoreMeasurement = mockCollapsedBreadcrumbOverflow()
    const onToggleFavorite = vi.fn()

    try {
      const { container } = render(
        <BreadcrumbBar entry={baseEntry} {...defaultProps} onToggleFavorite={onToggleFavorite} />,
      )

      await waitFor(() => {
        expect(container.querySelector('.breadcrumb-bar__actions')).toHaveAttribute('data-overflow-collapsed', 'true')
      })

      const menu = await openOverflowMenu()
      fireEvent.click(within(menu).getByRole('menuitem', { name: 'Add to favorites' }))
      expect(onToggleFavorite).toHaveBeenCalledTimes(1)
    } finally {
      restoreMeasurement()
    }
  })

  it('does not duplicate favorite/organized/reload/lock actions in the permanent overflow menu when not collapsed', async () => {
    render(
      <BreadcrumbBar
        entry={baseEntry}
        {...defaultProps}
        onToggleFavorite={vi.fn()}
        onToggleOrganized={vi.fn()}
        onReloadVault={vi.fn()}
        onToggleNoteLock={vi.fn()}
      />,
    )

    const menu = await openOverflowMenu()
    expect(within(menu).queryByRole('menuitem', { name: 'Add to favorites' })).not.toBeInTheDocument()
    expect(within(menu).queryByRole('menuitem', { name: 'Set note as organized' })).not.toBeInTheDocument()
    expect(within(menu).queryByRole('menuitem', { name: 'Reload vault' })).not.toBeInTheDocument()
    expect(within(menu).queryByRole('menuitem', { name: 'Lock note' })).not.toBeInTheDocument()
  })
})

describe('BreadcrumbBar — raw editor toggle', () => {
  it('shows Raw editor button with tooltip "Raw editor" when rawMode is off', () => {
    const onToggleRaw = vi.fn()
    render(<BreadcrumbBar entry={baseEntry} {...defaultProps} rawMode={false} onToggleRaw={onToggleRaw} />)
    expect(screen.getByRole('button', { name: 'Open the raw editor' })).toBeInTheDocument()
  })

  it('shows "Back to editor" tooltip when rawMode is on', () => {
    const onToggleRaw = vi.fn()
    render(<BreadcrumbBar entry={baseEntry} {...defaultProps} rawMode={true} onToggleRaw={onToggleRaw} />)
    expect(screen.getByRole('button', { name: 'Return to the editor' })).toBeInTheDocument()
  })

  it('calls onToggleRaw when raw button is clicked', () => {
    const onToggleRaw = vi.fn()
    render(<BreadcrumbBar entry={baseEntry} {...defaultProps} rawMode={false} onToggleRaw={onToggleRaw} />)
    fireEvent.click(screen.getByRole('button', { name: 'Open the raw editor' }))
    expect(onToggleRaw).toHaveBeenCalledOnce()
  })

  it('hides raw toggle when forceRawMode is true (non-markdown file)', () => {
    const onToggleRaw = vi.fn()
    render(<BreadcrumbBar entry={baseEntry} {...defaultProps} rawMode={true} onToggleRaw={onToggleRaw} forceRawMode={true} />)
    expect(screen.queryByRole('button', { name: 'Open the raw editor' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Return to the editor' })).not.toBeInTheDocument()
  })

  it('shows raw toggle when forceRawMode is false (markdown file)', () => {
    const onToggleRaw = vi.fn()
    render(<BreadcrumbBar entry={baseEntry} {...defaultProps} rawMode={false} onToggleRaw={onToggleRaw} forceRawMode={false} />)
    expect(screen.getByRole('button', { name: 'Open the raw editor' })).toBeInTheDocument()
  })
})

describe('BreadcrumbBar — note lock toggle', () => {
  it('hides lock button when onToggleNoteLock is omitted', () => {
    render(<BreadcrumbBar entry={baseEntry} {...defaultProps} />)
    expect(screen.queryByTestId('breadcrumb-note-lock')).not.toBeInTheDocument()
  })

  it('shows Lock note when unlocked and Unlock note when locked', () => {
    const onToggleNoteLock = vi.fn()
    const { rerender } = render(
      <BreadcrumbBar entry={baseEntry} {...defaultProps} noteLocked={false} onToggleNoteLock={onToggleNoteLock} />,
    )
    expect(screen.getByRole('button', { name: 'Lock note' })).toBeInTheDocument()

    rerender(
      <BreadcrumbBar entry={baseEntry} {...defaultProps} noteLocked onToggleNoteLock={onToggleNoteLock} />,
    )
    expect(screen.getByRole('button', { name: 'Unlock note' })).toBeInTheDocument()
  })

  it('calls onToggleNoteLock when clicked', () => {
    const onToggleNoteLock = vi.fn()
    render(
      <BreadcrumbBar entry={baseEntry} {...defaultProps} noteLocked={false} onToggleNoteLock={onToggleNoteLock} />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Lock note' }))
    expect(onToggleNoteLock).toHaveBeenCalledOnce()
  })
})

describe('BreadcrumbBar — note width toggle', () => {
  it('shows the wide width action while normal', () => {
    render(<BreadcrumbBar entry={baseEntry} {...defaultProps} noteWidth="normal" onToggleNoteWidth={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Switch to wide note width' })).toBeInTheDocument()
  })

  it('shows the normal width action while wide', () => {
    render(<BreadcrumbBar entry={baseEntry} {...defaultProps} noteWidth="wide" onToggleNoteWidth={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Switch to normal note width' })).toBeInTheDocument()
  })

  it('calls onToggleNoteWidth when the width button is clicked', () => {
    const onToggleNoteWidth = vi.fn()
    render(<BreadcrumbBar entry={baseEntry} {...defaultProps} noteWidth="normal" onToggleNoteWidth={onToggleNoteWidth} />)

    fireEvent.click(screen.getByRole('button', { name: 'Switch to wide note width' }))

    expect(onToggleNoteWidth).toHaveBeenCalledOnce()
  })
})

describe('BreadcrumbBar — AI panel toggle', () => {
  it('keeps the AI panel action out of the breadcrumb bar', () => {
    render(<BreadcrumbBar entry={baseEntry} {...defaultProps} />)
    expect(screen.queryByRole('button', { name: 'Open the AI panel' })).not.toBeInTheDocument()
  })

  it('does not render the breadcrumb AI panel action when a toggle callback is available', () => {
    const onToggleAIChat = vi.fn()
    render(<BreadcrumbBar entry={baseEntry} {...defaultProps} onToggleAIChat={onToggleAIChat} />)

    expect(screen.queryByRole('button', { name: 'Open the AI panel' })).not.toBeInTheDocument()
    expect(onToggleAIChat).not.toHaveBeenCalled()
  })
})

describe('BreadcrumbBar — table of contents toggle', () => {
  it('shows the table of contents action and calls the toggle handler', () => {
    const onToggleTableOfContents = vi.fn()
    render(
      <BreadcrumbBar
        entry={baseEntry}
        {...defaultProps}
        onToggleTableOfContents={onToggleTableOfContents}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Open table of contents' }))

    expect(onToggleTableOfContents).toHaveBeenCalledOnce()
  })

  it('uses the close label while the table of contents panel is active', () => {
    render(
      <BreadcrumbBar
        entry={baseEntry}
        {...defaultProps}
        showTableOfContents
        onToggleTableOfContents={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: 'Close table of contents' })).toBeInTheDocument()
  })

  it('shows the table of contents shortcut in the button tooltip', async () => {
    render(<BreadcrumbBar entry={baseEntry} {...defaultProps} onToggleTableOfContents={vi.fn()} />)
    await expectTooltip(
      screen.getByRole('button', { name: 'Open table of contents' }),
      'Open table of contents',
      formatShortcutDisplay({ display: '⌘⇧T' }),
    )
  })

  it('offers the table of contents action from the overflow menu', async () => {
    const onToggleTableOfContents = vi.fn()
    const restoreMeasurement = mockCollapsedBreadcrumbOverflow()

    try {
      const { container } = render(
        <BreadcrumbBar
          entry={baseEntry}
          {...defaultProps}
          onToggleTableOfContents={onToggleTableOfContents}
        />,
      )

      await waitFor(() => {
        expect(container.querySelector('.breadcrumb-bar__actions')).toHaveAttribute('data-overflow-collapsed', 'true')
      })

      const menu = await openOverflowMenu()
      fireEvent.click(within(menu).getByRole('menuitem', { name: 'Open table of contents' }))

      expect(onToggleTableOfContents).toHaveBeenCalledOnce()
    } finally {
      restoreMeasurement()
    }
  })
})

describe('BreadcrumbBar — close note', () => {
  it('does not render a close control without a handler', () => {
    render(<BreadcrumbBar entry={baseEntry} {...defaultProps} />)

    expect(screen.queryByRole('button', { name: 'Close note' })).not.toBeInTheDocument()
  })

  it('closes the open note from the header', () => {
    const onCloseNote = vi.fn()
    render(<BreadcrumbBar entry={baseEntry} {...defaultProps} onCloseNote={onCloseNote} />)

    fireEvent.click(screen.getByTestId('breadcrumb-close-note'))

    expect(onCloseNote).toHaveBeenCalledOnce()
  })

  it('keeps the sidebar-looking control as Properties, not Close', () => {
    const onToggleInspector = vi.fn()
    const onCloseNote = vi.fn()
    render(
      <BreadcrumbBar
        entry={baseEntry}
        {...defaultProps}
        inspectorCollapsed
        onToggleInspector={onToggleInspector}
        onCloseNote={onCloseNote}
      />,
    )

    fireEvent.click(screen.getByTestId('breadcrumb-properties-button'))
    expect(onToggleInspector).toHaveBeenCalledOnce()
    expect(onCloseNote).not.toHaveBeenCalled()
    expect(screen.getByTestId('breadcrumb-close-note')).toHaveAccessibleName('Close note')
    expect(screen.getByTestId('breadcrumb-properties-button')).toHaveAccessibleName(/properties/i)
  })
})

/**
 * Browser preview, 2026-09-26: in a 360px desk note pane the actions group
 * (511px, shrink-0) ran past the pane's right edge. The collapse check
 * anchored on the actions' own right edge, which had moved off-screen, so it
 * concluded the title had room: the title showed two letters and Close sat
 * 320px outside the pane. The check must anchor on the bar's right edge.
 */
describe('BreadcrumbBar — actions that overflow the bar still collapse', () => {
  it('collapses when the actions run past the bar, even with room left of them', async () => {
    const requestFrame = vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((callback) => {
      callback(0)
      return 1
    })
    const cancelFrame = vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => {})
    const rects = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.classList.contains('breadcrumb-bar')) return DOMRect.fromRect({ x: 637, y: 0, width: 360, height: 52 })
      if (this.classList.contains('breadcrumb-bar__actions')) return DOMRect.fromRect({ x: 838, y: 0, width: 511, height: 52 })
      return DOMRect.fromRect({ x: 697, y: 0, width: 95, height: 52 })
    })
    const scrollWidths = vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockImplementation(function (this: HTMLElement) {
      return this.classList.contains('breadcrumb-bar__actions') ? 511 : 95
    })
    try {
      const { container } = render(<BreadcrumbBar entry={baseEntry} {...defaultProps} />)
      await waitFor(() => {
        expect(container.querySelector('.breadcrumb-bar__actions')).toHaveAttribute('data-overflow-collapsed', 'true')
      })
    } finally {
      requestFrame.mockRestore()
      cancelFrame.mockRestore()
      rects.mockRestore()
      scrollWidths.mockRestore()
    }
  })
})
