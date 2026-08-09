import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { VaultEntry } from '../../types'
import { DynamicRelationshipsPanel } from './RelationshipsPanel'

const makeEntry = (overrides: Partial<VaultEntry> = {}): VaultEntry => ({
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
  properties: {},
  organized: false,
  favorite: false,
  favoriteIndex: null,
  listPropertiesDisplay: [],
  hasH1: true,
  outgoingLinks: [],
  ...overrides,
})

describe('relationship layout regression', () => {
  it('renders suggested relationship slots as full-width stacked rows with property-style labels', () => {
    render(
      <DynamicRelationshipsPanel
        frontmatter={{}}
        entries={[makeEntry({ path: '/vault/project-alpha.md', filename: 'project-alpha.md', title: 'Project Alpha', isA: 'Project' })]}
        typeEntryMap={{}}
        onNavigate={vi.fn()}
        onAddProperty={vi.fn()}
      />,
    )

    const belongsToSlot = screen.getAllByTestId('suggested-relationship').find((slot) =>
      within(slot).queryByText('Belongs to'),
    )

    expect(belongsToSlot).toBeTruthy()
    expect(belongsToSlot).toHaveStyle({ gridColumn: '1 / -1' })

    const label = within(belongsToSlot!).getByTestId('relationship-section-label')
    expect(label).toHaveClass('text-[12px]')
    expect(within(label).queryByTestId('relationship-section-icon-slot')).not.toBeInTheDocument()
    expect(within(belongsToSlot!).getByTestId('add-relation-ref')).toBeInTheDocument()
  })

  it('removes relationship arrows and keeps the looser vertical spacing between rows', () => {
    render(
      <DynamicRelationshipsPanel
        frontmatter={{}}
        entries={[makeEntry({ path: '/vault/project-alpha.md', filename: 'project-alpha.md', title: 'Project Alpha', isA: 'Project' })]}
        typeEntryMap={{}}
        onNavigate={vi.fn()}
        onAddProperty={vi.fn()}
      />,
    )

    expect(screen.getByTestId('relationships-panel-grid')).toHaveClass('gap-y-3')
    expect(screen.queryByTestId('relationship-section-icon-slot')).not.toBeInTheDocument()
  })
})
