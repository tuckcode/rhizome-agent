import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render as rtlRender, screen } from '@testing-library/react'
import { TooltipProvider } from '@/components/ui/tooltip'
import { EditorRightPanel } from './EditorRightPanel'
import type { VaultEntry } from '../types'
import { bindVaultConfigStore, resetVaultConfigStore } from '../utils/vaultConfigStore'

const entry: VaultEntry = {
  path: '/vault/note/test.md',
  filename: 'test.md',
  title: 'Test Note',
  isA: 'Note',
  aliases: [],
  belongsTo: [],
  relatedTo: [],
  status: null,
  owner: null,
  cadence: null,
  archived: false,
  modifiedAt: 1700000000,
  createdAt: 1700000000,
  fileSize: 100,
  snippet: '',
  wordCount: 0,
  relationships: {},
  icon: null,
  color: null,
  order: null,
  sidebarLabel: null,
  template: null,
  sort: null,
  view: null,
  visible: null,
  organized: false,
  favorite: false,
  favoriteIndex: null,
  listPropertiesDisplay: [],
  outgoingLinks: [],
  properties: {},
  hasH1: false,
}

function renderRightPanel({
  inspectorCollapsed = true,
  showTableOfContents = false,
}: {
  inspectorCollapsed?: boolean
  showTableOfContents?: boolean
} = {}) {
  return rtlRender(
    <EditorRightPanel
      showTableOfContents={showTableOfContents}
      inspectorCollapsed={inspectorCollapsed}
      inspectorWidth={320}
      editor={{} as never}
      inspectorEntry={entry}
      inspectorContent="# Test Note\n\nBody"
      entries={[entry]}
      gitHistory={[]}
      vaultPath="/tmp/vault"
      onToggleInspector={vi.fn()}
      onNavigateWikilink={vi.fn()}
      onViewCommitDiff={vi.fn()}
    />,
    { wrapper: TooltipProvider },
  )
}

describe('EditorRightPanel', () => {
  beforeEach(() => {
    resetVaultConfigStore()
    bindVaultConfigStore({
      zoom: null,
      view_mode: null,
      editor_mode: null,
      note_layout: null,
      tag_colors: null,
      status_colors: null,
      property_display_modes: null,
      inbox: null,
      allNotes: null,
      ai_agent_permission_mode: 'safe',
    }, vi.fn())
  })

  it('shows properties when the inspector is open', () => {
    renderRightPanel({ inspectorCollapsed: false })

    expect(screen.getByTestId('properties-panel-icon')).toBeTruthy()
    expect(screen.getByText('Properties')).toBeTruthy()
    expect(screen.queryByTestId('ai-panel')).toBeNull()
  })

  it('shows the table of contents when that panel is open', () => {
    renderRightPanel({ showTableOfContents: true })

    expect(screen.getByTestId('table-of-contents-panel')).toBeTruthy()
    expect(screen.queryByTestId('ai-panel')).toBeNull()
  })

  it('renders nothing when both side panels are closed', () => {
    const { container } = renderRightPanel()

    expect(container).toBeEmptyDOMElement()
    expect(screen.queryByTestId('ai-panel')).toBeNull()
  })
})
